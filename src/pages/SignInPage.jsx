import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

export function SignInPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  const onGoogleSignIn = async () => {
    setLoading(true)
    setError('')
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
    }
  }

  return (
    <main className="page auth-page">
      <section className="auth-card glass">
        <h2>Sign in to create private rooms</h2>
        <p>
          Admin access belongs to the room creator. Guests can join through your
          room link without Google sign-in.
        </p>
        <button
          className="button primary full"
          onClick={onGoogleSignIn}
          disabled={loading}
        >
          {loading ? 'Redirecting...' : 'Continue with Google'}
        </button>
        {error && <p className="error">{error}</p>}
        <Link to="/" className="inline-link">
          Back to home
        </Link>
      </section>
    </main>
  )
}
