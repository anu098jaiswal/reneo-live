import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import ProductForm from './ProductForm'
import LiveSeller from './LiveSeller'
import ErrorBanner from '../components/ErrorBanner'
import type { Product } from '../types'

export default function SellerDashboard() {
  const { profile } = useAuth()
  const online = useOnlineStatus()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [liveSession, setLiveSession] = useState<{ sessionId: string; product: Product } | null>(
    null
  )

  async function cleanupOrphanedSessions() {
    if (!profile) return
    await supabase
      .from('live_sessions')
      .update({ status: 'ended' })
      .eq('host_id', profile.id)
      .eq('status', 'live')
  }

  async function loadProducts() {
    if (!profile) return
    setLoading(true)
    setError('')
    const { data, error: fetchError } = await supabase
      .from('products')
      .select('*')
      .eq('seller_id', profile.id)
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError('Could not load your products.')
    } else {
      setProducts(data ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    cleanupOrphanedSessions()
    loadProducts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  async function goLive(product: Product) {
    if (!profile) return
    setError('')

    // Ensure any previous live sessions for this host are ended first
    await supabase
      .from('live_sessions')
      .update({ status: 'ended' })
      .eq('host_id', profile.id)
      .eq('status', 'live')

    const { data, error: insertError } = await supabase
      .from('live_sessions')
      .insert({ host_id: profile.id, product_id: product.id, status: 'live' })
      .select()
      .single()

    if (insertError || !data) {
      setError('Could not start the live session. Please try again.')
      return
    }
    setLiveSession({ sessionId: data.id, product })
  }

  async function deleteProduct(productId: string) {
    if (!window.confirm('Are you sure you want to delete this product?')) return
    setError('')
    const { error: deleteError } = await supabase
      .from('products')
      .delete()
      .eq('id', productId)

    if (deleteError) {
      setError('Could not delete product.')
    } else {
      loadProducts()
    }
  }

  if (liveSession) {
    return (
      <LiveSeller
        sessionId={liveSession.sessionId}
        product={liveSession.product}
        onEnded={() => {
          setLiveSession(null)
          loadProducts()
        }}
      />
    )
  }

  return (
    <div className="dashboard">
      {!online && <ErrorBanner message="You're offline — changes won't save until you reconnect." />}
      {error && <ErrorBanner message={error} onRetry={loadProducts} />}

      <div className="dashboard-header">
        <h2>Your products</h2>
        <button onClick={() => setShowForm(s => !s)}>
          {showForm ? 'Close' : '+ New product'}
        </button>
      </div>

      {showForm && (
        <ProductForm
          onCreated={() => {
            setShowForm(false)
            loadProducts()
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {loading ? (
        <p>Loading products...</p>
      ) : products.length === 0 ? (
        <p>No products yet — add one to go live.</p>
      ) : (
        <div className="product-grid">
          {products.map(product => (
            <div key={product.id} className="product-card">
              {product.image_url && <img src={product.image_url} alt={product.name} />}
              <h4>{product.name}</h4>
              <p>₹{product.price}</p>
              <p className="stock">{product.stock} in stock</p>
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button onClick={() => goLive(product)} disabled={!online || product.stock === 0}>
                  Go Live
                </button>
                <button
                  onClick={() => deleteProduct(product.id)}
                  style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
