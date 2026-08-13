import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import type { CartItem, Product } from '../types'

export interface CartLine extends CartItem {
  product: Product
}

interface CartContextType {
  lines: CartLine[]
  loading: boolean
  error: string
  total: number
  addToCart: (product: Product) => Promise<void>
  updateQuantity: (lineId: string, quantity: number) => Promise<void>
  removeFromCart: (lineId: string) => Promise<void>
  refresh: () => Promise<void>
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const [lines, setLines] = useState<CartLine[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function refresh() {
    if (!profile) return
    setLoading(true)
    setError('')
    const { data, error: fetchError } = await supabase
      .from('cart_items')
      .select('*, product:products(*)')
      .eq('customer_id', profile.id)

    if (fetchError) {
      setError('Could not load your cart.')
    } else {
      setLines((data as unknown as CartLine[]) ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    if (profile) refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  async function addToCart(product: Product) {
    if (!profile) return
    setError('')
    const existing = lines.find(l => l.product_id === product.id)

    if (existing) {
      await updateQuantity(existing.id, existing.quantity + 1)
      return
    }

    const { error: insertError } = await supabase
      .from('cart_items')
      .insert({ customer_id: profile.id, product_id: product.id, quantity: 1 })

    if (insertError) {
      setError('Could not add item to cart.')
      return
    }
    await refresh()
  }

  async function updateQuantity(lineId: string, quantity: number) {
    setError('')
    if (quantity < 1) {
      await removeFromCart(lineId)
      return
    }
    const { error: updateError } = await supabase
      .from('cart_items')
      .update({ quantity })
      .eq('id', lineId)

    if (updateError) {
      setError('Could not update quantity.')
      return
    }
    await refresh()
  }

  async function removeFromCart(lineId: string) {
    setError('')
    const { error: deleteError } = await supabase.from('cart_items').delete().eq('id', lineId)
    if (deleteError) {
      setError('Could not remove item.')
      return
    }
    await refresh()
  }

  const total = lines.reduce((sum, l) => sum + l.quantity * (l.product?.price ?? 0), 0)

  return (
    <CartContext.Provider
      value={{ lines, loading, error, total, addToCart, updateQuantity, removeFromCart, refresh }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside CartProvider')
  return ctx
}
