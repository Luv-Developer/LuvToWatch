import { useEffect, useMemo, useRef, useState } from 'react'
import ReactPlayer from 'react-player'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { getGuestIdentity } from '../utils/room'

const rtcConfig = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
}

export function RoomPage() {
  const { roomKey } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const playerRef = useRef(null)
  const channelRef = useRef(null)
  const localAudioStreamRef = useRef(null)
  const peerConnectionsRef = useRef({})
  const currentTimeRef = useRef(0)
  const isRemoteActionRef = useRef(false)
  const ignoreNextSeekedRef = useRef(false)
  const [room, setRoom] = useState(null)
  const [identity, setIdentity] = useState(null)
  const [name, setName] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [participants, setParticipants] = useState([])
  const [videoUrl, setVideoUrl] = useState('')
  const [pendingUrl, setPendingUrl] = useState('')
  const [playing, setPlaying] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [messages, setMessages] = useState([])
  const [micEnabled, setMicEnabled] = useState(false)
  const [remoteAudioStreams, setRemoteAudioStreams] = useState({})
  const [mutedByAdmin, setMutedByAdmin] = useState(false)
  const [error, setError] = useState('')
  const [videoError, setVideoError] = useState('')
  const getSafeCurrentTime = () => {
    const el = playerRef.current
    if (
      el &&
      typeof el.currentTime === 'number' &&
      Number.isFinite(el.currentTime)
    ) {
      return el.currentTime
    }
    const legacy = el?.getCurrentTime?.()
    if (typeof legacy === 'number' && Number.isFinite(legacy)) {
      return legacy
    }
    return currentTimeRef.current
  }

  const seekPlayerTo = (seconds) => {
    const el = playerRef.current
    if (!el) {
      return
    }
    const t = Number.isFinite(seconds) ? Math.max(0, seconds) : 0
    if (typeof el.seekTo === 'function') {
      el.seekTo(t, 'seconds')
    } else {
      el.currentTime = t
    }
  }


  const shareUrl = useMemo(
    () => `${window.location.origin}/room/${roomKey}`,
    [roomKey],
  )

  useEffect(() => {
    const bootstrap = async () => {
      const { data, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('room_key', roomKey)
        .maybeSingle()

      if (roomError || !data) {
        setError('Room not found. Ask the creator for a valid private link.')
        return
      }

      const guest = getGuestIdentity(roomKey)
      const activeIdentity = user?.id ?? guest.id
      const activeName =
        user?.user_metadata?.full_name ?? user?.email ?? guest.name
      const creator = user?.id === data.admin_id

      setRoom(data)
      setIdentity(activeIdentity)
      setName(activeName)
      setIsAdmin(creator)
    }

    bootstrap()
  }, [roomKey, user])

  useEffect(() => {
    if (!identity || !room) {
      return
    }

    const channel = supabase.channel(`room-${roomKey}`, {
      config: { presence: { key: identity } },
    })
    channelRef.current = channel

    const onRoomEvent = ({ payload }) => {
      if (!payload || payload.sender === identity) {
        return
      }

      if (payload.type === 'chat') {
        setMessages((prev) => [...prev, payload.message])
        return
      }

      if (payload.type === 'video') {
        ignoreNextSeekedRef.current = true
        isRemoteActionRef.current = true
        setVideoUrl(payload.state.url)
        setPlaying(payload.state.playing)
        setTimeout(() => {
          seekPlayerTo(payload.state.time ?? 0)
        }, 150)
        // Allow play/pause from this sync to settle without echoing to the room.
        setTimeout(() => {
          isRemoteActionRef.current = false
        }, 600)
        return
      }

      if (payload.type === 'kick' && payload.target === identity) {
        navigate('/')
        return
      }

      if (payload.type === 'mute' && payload.target === identity) {
        const isMuted = Boolean(payload.muted)
        setMutedByAdmin(isMuted)
        if (isMuted) {
          disableMic()
        }
        return
      }

      if (payload.type === 'voice-offer' && payload.target === identity) {
        handleOffer(payload)
        return
      }

      if (payload.type === 'voice-answer' && payload.target === identity) {
        handleAnswer(payload)
        return
      }

      if (payload.type === 'voice-ice' && payload.target === identity) {
        handleIce(payload)
      }
    }

    const refreshPresence = () => {
      const state = channel.presenceState()
      const users = Object.values(state)
        .flat()
        .map((entry) => ({
          identity: entry.identity,
          name: entry.name,
          isAdmin: entry.isAdmin,
          muted: entry.muted ?? false,
        }))
      setParticipants(users)
    }

    channel
      .on('broadcast', { event: 'room-event' }, onRoomEvent)
      .on('presence', { event: 'sync' }, () => {
        refreshPresence()
      })
      .subscribe(async (status) => {
        if (status !== 'SUBSCRIBED') {
          return
        }
        await channel.track({
          identity,
          name,
          isAdmin,
          muted: mutedByAdmin,
        })
      })

    return () => {
      disableMic()
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [identity, isAdmin, mutedByAdmin, name, navigate, room, roomKey])

  useEffect(() => {
    if (!micEnabled) {
      return
    }
    participants.forEach((participant) => {
      if (participant.identity !== identity) {
        createOffer(participant.identity)
      }
    })
  }, [identity, micEnabled, participants])

  const sendRoomEvent = async (payload) => {
    if (!channelRef.current) {
      return
    }
    await channelRef.current.send({
      type: 'broadcast',
      event: 'room-event',
      payload: { ...payload, sender: identity },
    })
  }

  const postChat = async (event) => {
    event.preventDefault()
    if (!chatInput.trim()) {
      return
    }
    const message = {
      id: crypto.randomUUID(),
      sender: name,
      text: chatInput.trim(),
      time: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, message])
    setChatInput('')
    await sendRoomEvent({ type: 'chat', message })
  }

  const shareCurrentVideoState = async (nextState) => {
    await sendRoomEvent({
      type: 'video',
      state: nextState,
    })
  }

  const loadVideo = async () => {
    if (!pendingUrl.trim()) {
      return
    }
    let nextUrl = pendingUrl.trim()
    if (!/^https?:\/\//i.test(nextUrl)) {
      nextUrl = `https://${nextUrl}`
    }

    if (!ReactPlayer.canPlay(nextUrl)) {
      setVideoError(
        'Unsupported link. Paste a valid YouTube or direct video URL.',
      )
      return
    }

    setVideoError('')
    setVideoUrl(nextUrl)
    setPlaying(false)
    await shareCurrentVideoState({ url: nextUrl, playing: false, time: 0 })
  }

  const onPlay = async () => {
    setPlaying(true)
    if (!isRemoteActionRef.current) {
      await shareCurrentVideoState({
        url: videoUrl,
        playing: true,
        time: getSafeCurrentTime(),
      })
    }
  }

  const onPause = async () => {
    setPlaying(false)
    const pausedAt = getSafeCurrentTime()
    currentTimeRef.current = pausedAt
    if (!isRemoteActionRef.current) {
      await shareCurrentVideoState({
        url: videoUrl,
        playing: false,
        time: pausedAt,
      })
    }
  }

  const onSeeked = async () => {
    const seconds = getSafeCurrentTime()
    currentTimeRef.current = seconds
    if (ignoreNextSeekedRef.current) {
      ignoreNextSeekedRef.current = false
      return
    }
    if (!isRemoteActionRef.current) {
      await shareCurrentVideoState({
        url: videoUrl,
        playing,
        time: seconds,
      })
    }
  }

  const onTimeUpdate = () => {
    currentTimeRef.current = getSafeCurrentTime()
  }

  const onKick = async (target) => {
    if (!isAdmin) {
      return
    }
    await sendRoomEvent({ type: 'kick', target })
  }

  const onMute = async (target, muted) => {
    if (!isAdmin) {
      return
    }
    await sendRoomEvent({ type: 'mute', target, muted })
  }

  const createOffer = async (targetIdentity) => {
    if (!localAudioStreamRef.current) {
      return
    }
    const pc = createPeerConnection(targetIdentity)
    localAudioStreamRef.current.getTracks().forEach((track) => {
      pc.addTrack(track, localAudioStreamRef.current)
    })
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    await sendRoomEvent({
      type: 'voice-offer',
      target: targetIdentity,
      sdp: offer,
    })
  }

  const createPeerConnection = (targetIdentity) => {
    if (peerConnectionsRef.current[targetIdentity]) {
      return peerConnectionsRef.current[targetIdentity]
    }
    const pc = new RTCPeerConnection(rtcConfig)
    peerConnectionsRef.current[targetIdentity] = pc

    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        await sendRoomEvent({
          type: 'voice-ice',
          target: targetIdentity,
          candidate: event.candidate,
        })
      }
    }

    pc.ontrack = (event) => {
      setRemoteAudioStreams((prev) => ({
        ...prev,
        [targetIdentity]: event.streams[0],
      }))
    }

    return pc
  }

  const handleOffer = async (payload) => {
    if (mutedByAdmin) {
      return
    }
    if (!localAudioStreamRef.current) {
      await enableMic()
    }
    const pc = createPeerConnection(payload.sender)
    await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    await sendRoomEvent({
      type: 'voice-answer',
      target: payload.sender,
      sdp: answer,
    })
  }

  const handleAnswer = async (payload) => {
    const pc = peerConnectionsRef.current[payload.sender]
    if (!pc) {
      return
    }
    await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
  }

  const handleIce = async (payload) => {
    const pc = peerConnectionsRef.current[payload.sender]
    if (!pc) {
      return
    }
    await pc.addIceCandidate(new RTCIceCandidate(payload.candidate))
  }

  const enableMic = async () => {
    if (mutedByAdmin) {
      return
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    })
    localAudioStreamRef.current = stream
    setMicEnabled(true)
  }

  const disableMic = () => {
    setMicEnabled(false)
    const stream = localAudioStreamRef.current
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      localAudioStreamRef.current = null
    }
    Object.values(peerConnectionsRef.current).forEach((pc) => pc.close())
    peerConnectionsRef.current = {}
    setRemoteAudioStreams({})
  }

  const toggleMic = async () => {
    if (micEnabled) {
      disableMic()
      return
    }
    await enableMic()
  }

  if (error) {
    return (
      <main className="page room-page">
        <section className="glass room-card">
          <h2>Room unavailable</h2>
          <p>{error}</p>
          <Link className="button secondary" to="/">
            Go home
          </Link>
        </section>
      </main>
    )
  }

  if (!room) {
    return <main className="page loading-page">Joining room...</main>
  }

  return (
    <main className="page room-page">
      <section className="room-card glass">
        <div className="row space wrap">
          <div>
            <h2>{room.room_key}</h2>
            <p className="room-meta">
              {isAdmin ? 'Admin controls enabled' : 'Guest access'}
            </p>
          </div>
          <div className="row wrap gap">
            <button
              className="button secondary"
              onClick={() => navigator.clipboard.writeText(shareUrl)}
            >
              Copy invite link
            </button>
            <button
              className={`button ${micEnabled ? 'danger' : 'secondary'}`}
              onClick={toggleMic}
              disabled={mutedByAdmin}
            >
              {mutedByAdmin
                ? 'Muted by admin'
                : micEnabled
                  ? 'Mic on'
                  : 'Mic off'}
            </button>
          </div>
        </div>

        <div className="video-search">
          <input
            placeholder="Paste YouTube or direct video URL"
            value={pendingUrl}
            onChange={(event) => setPendingUrl(event.target.value)}
          />
          <button className="button primary" onClick={loadVideo}>
            Search / Load
          </button>
        </div>
        {videoError && <p className="error">{videoError}</p>}

        <div className="room-grid">
          <div className="player-panel">
            {videoUrl ? (
              <div className="player-wrapper">
                <ReactPlayer
                  ref={playerRef}
                  className="room-player"
                  src={videoUrl}
                  width="100%"
                  height="100%"
                  controls
                  playing={playing}
                  onPlay={onPlay}
                  onPause={onPause}
                  onSeeked={onSeeked}
                  onTimeUpdate={onTimeUpdate}
                />
              </div>
            ) : (
              <div className="placeholder">
                Add a video URL above to start watching with your room.
              </div>
            )}
          </div>

          <aside className="sidebar">
            <div className="panel glass">
              <h3>Participants ({participants.length})</h3>
              <ul className="participants">
                {participants.map((member) => (
                  <li key={member.identity}>
                    <span>
                      {member.name}
                      {member.isAdmin ? ' (Admin)' : ''}
                    </span>
                    {isAdmin && member.identity !== identity && (
                      <div className="row gap">
                        <button
                          className="mini danger"
                          onClick={() => onKick(member.identity)}
                        >
                          Kick
                        </button>
                        <button
                          className="mini"
                          onClick={() => onMute(member.identity, true)}
                        >
                          Mute
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div className="panel glass">
              <h3>Chat</h3>
              <div className="messages">
                {messages.map((message) => (
                  <p key={message.id}>
                    <strong>{message.sender}:</strong> {message.text}
                  </p>
                ))}
              </div>
              <form className="chat-form" onSubmit={postChat}>
                <input
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  placeholder="Send a message"
                />
                <button className="button primary" type="submit">
                  Send
                </button>
              </form>
            </div>
          </aside>
        </div>
      </section>
      {Object.entries(remoteAudioStreams).map(([key, stream]) => (
        <audio
          key={key}
          autoPlay
          playsInline
          ref={(node) => {
            if (node) {
              node.srcObject = stream
            }
          }}
        />
      ))}
    </main>
  )
}
