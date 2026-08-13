import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

interface Props {
  onCreated: () => void
  onCancel: () => void
}

export default function ProductForm({ onCreated, onCancel }: Props) {
  const { profile } = useAuth()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [stock, setStock] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return
    setError('')
    setSubmitting(true)

    try {
      let imageUrl: string | null = null

      if (imageFile) {
        const ext = imageFile.name.split('.').pop()
        const path = `${profile.id}/${crypto.randomUUID()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(path, imageFile)
        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(path)
        imageUrl = urlData.publicUrl
      }

      const { error: insertError } = await supabase.from('products').insert({
        seller_id: profile.id,
        name,
        description,
        price: Number(price),
        stock: Number(stock),
        image_url: imageUrl,
        status: 'active',
      })

      if (insertError) throw insertError
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create product. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="product-form">
      <h3>New product</h3>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Name" required />
      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Description"
      />
      <input
        value={price}
        onChange={e => setPrice(e.target.value)}
        type="number"
        step="0.01"
        min="0"
        placeholder="Price"
        required
      />
      <input
        value={stock}
        onChange={e => setStock(e.target.value)}
        type="number"
        min="0"
        placeholder="Stock"
        required
      />
      <input
        type="file"
        accept="image/*"
        onChange={e => setImageFile(e.target.files?.[0] ?? null)}
      />
      {error && <p className="error">{error}</p>}
      <div className="form-actions">
        <button type="button" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" disabled={submitting}>
          {submitting ? 'Saving...' : 'Save product'}
        </button>
      </div>
    </form>
  )
}
