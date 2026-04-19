import { Link } from 'react-router-dom'

export function HomePage() {
  return (
    <main className="page home-page">
      <div className="aurora aurora-a" />
      <div className="aurora aurora-b" />
      <header className="hero-card glass">
        <p className="badge">LuvToWatch</p>
        <h1>Watch together. Chat together. Feel together.</h1>
        <p className="subtitle">
          Create a private room, drop any YouTube or direct video URL, and sync
          playback with your friends in real-time without sharing your screen.
        </p>
        <div className="hero-actions">
          <Link className="button primary" to="/signin">
            Sign in with Google
          </Link>
          <Link className="button secondary" to="/room/demo-room">
            Try room preview
          </Link>
        </div>
      </header>

      <section className="feature-grid">
        <article className="feature glass">
          <h3>Private room links</h3>
          <p>Generate a unique room key and invite others with one secure URL.</p>
        </article>
        <article className="feature glass">
          <h3>Live synced playback</h3>
          <p>Play, pause, seek, and load videos together with instant updates.</p>
        </article>
        <article className="feature glass">
          <h3>Chat + Voice</h3>
          <p>Message in sidebar chat and toggle mic audio for natural discussion.</p>
        </article>
        <article className="feature glass">
          <h3>Admin moderation</h3>
          <p>Room creators can mute or remove participants to keep it clean.</p>
        </article>
      </section>
    </main>
  )
}
