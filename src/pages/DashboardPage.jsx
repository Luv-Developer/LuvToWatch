import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { createRoomKey } from '../utils/room'

export function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [newRoomLoading, setNewRoomLoading] = useState(false)
  const [joinKey, setJoinKey] = useState('')
  const [error, setError] = useState('')

  const createRoom = async () => {
    if (!user) {
      return
    }

    const roomKey = createRoomKey()
    setNewRoomLoading(true)
    setError('')

    const { error: insertError } = await supabase.from('rooms').insert({
      room_key: roomKey,
      admin_id: user.id,
      admin_name: user.user_metadata?.full_name ?? user.email ?? 'Host',
    })

    setNewRoomLoading(false)
    if (insertError) {
      setError(insertError.message)
      return
    }

    navigate(`/room/${roomKey}`)
  }

  const joinRoom = () => {
    if (!joinKey.trim()) {
      return
    }
    navigate(`/room/${joinKey.trim()}`)
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <main className="page dashboard-page">
      <section className="dashboard-card glass">
        <div className="row space">
          <h2>Welcome, {user?.user_metadata?.full_name ?? 'Creator'}</h2>
          <button className="button secondary" onClick={signOut}>
            Sign out
          </button>
        </div>
        <p>
          Create your private room and share the generated link. Guests can join
          directly without authentication.
        </p>

        <div className="row wrap gap">
          <button
            className="button primary"
            onClick={createRoom}
            disabled={newRoomLoading}
          >
            {newRoomLoading ? 'Creating room...' : 'Create private room'}
          </button>
          <div className="join-inline">
            <input
              placeholder="Enter room key"
              value={joinKey}
              onChange={(event) => setJoinKey(event.target.value)}
            />
            <button className="button secondary" onClick={joinRoom}>
              Join
            </button>
          </div>
        </div>
        {error && <p className="error">{error}</p>}
        <Link className="inline-link" to="/">
          Back to home
        </Link>
      </section>
    </main>
  )
}
