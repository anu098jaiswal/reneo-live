import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import ErrorBanner from '../components/ErrorBanner'
import LiveCustomer from './LiveCustomer'
import type { LiveSession, Product } from '../types'

interface LiveSessionWithProduct extends LiveSession {
  product: Product
  sellerName: string
}

export default function CustomerFeed() {
  const [sessions, setSessions] = useState<LiveSessionWithProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeSession, setActiveSession] = useState<LiveSession | null>(null)

  async function loadLiveSessions() {
    setLoading(true)
    setError('')
    const { data, error: fetchError } = await supabase
      .from('live_sessions')
      .select('*, product:products(*), host:profiles(name)')
      .eq('status', 'live')
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError('Could not load live sessions.')
    } else {
      setSessions(
        (data ?? []).map((s: any) => ({ ...s, sellerName: s.host?.name ?? 'Seller' }))
      )
    }
    setLoading(false)
  }

  useEffect(() => {
    loadLiveSessions()

    // Refresh the feed whenever a session goes live or ends, so it never
    // shows a stale "live" that already ended.
    const channel = supabase
      .channel('live-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_sessions' }, () => {
        loadLiveSessions()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function joinSession(session: LiveSessionWithProduct) {
    setError('')
    // Re-check status right before joining — the feed could be a few
    // seconds stale (A11: "live already ended").
    const { data, error: checkError } = await supabase
      .from('live_sessions')
      .select('*')
      .eq('id', session.id)
      .single()

    if (checkError || !data) {
      setError('This live session no longer exists.')
      loadLiveSessions()
      return
    }
    if (data.status === 'ended') {
      setError('This live session has already ended.')
      loadLiveSessions()
      return
    }
    setActiveSession(data)
  }

  if (activeSession) {
    return <LiveCustomer session={activeSession} onLeave={() => setActiveSession(null)} />
  }

  return (
    <div className="feed">
      {error && <ErrorBanner message={error} onRetry={loadLiveSessions} />}
      <h2>Live now</h2>
      {loading ? (
        <p>Loading...</p>
      ) : sessions.length === 0 ? (
        <p>No live sessions right now — check back soon.</p>
      ) : (
        <div className="session-grid">
          {sessions.map(session => (
            <div key={session.id} className="session-card" onClick={() => joinSession(session)}>
              {session.product?.image_url && (
                <img src={session.product.image_url} alt={session.product.name} />
              )}
              <span className="live-badge">● LIVE</span>
              <h4>{session.product?.name}</h4>
              <p>by {session.sellerName}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
