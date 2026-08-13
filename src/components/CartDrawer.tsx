import { useState } from 'react'
import { useCart } from '../context/CartContext'

interface Props {
  onClose: () => void
}

export default function CartDrawer({ onClose }: Props) {
  const { lines, total, updateQuantity, removeFromCart, clearCart, error } = useCart()
  const [checkedOut, setCheckedOut] = useState(false)

  async function handleCheckout() {
    await clearCart()
    setCheckedOut(true)
    setTimeout(() => {
      setCheckedOut(false)
      onClose()
    }, 2000)
  }

  return (
    <div className="cart-drawer">
      <div className="cart-header">
        <h3>Your cart</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          {lines.length > 0 && (
            <button className="link-btn" onClick={clearCart}>
              Clear
            </button>
          )}
          <button onClick={onClose}>Close</button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {checkedOut && <p className="success-msg" style={{ color: '#10b981', margin: '8px 0' }}>Order placed! Cart cleared.</p>}

      {lines.length === 0 ? (
        <p>Your cart is empty.</p>
      ) : (
        <>
          {lines.map(line => (
            <div key={line.id} className="cart-line">
              <span>{line.product?.name ?? 'Product'}</span>
              <div className="qty-controls">
                <button onClick={() => updateQuantity(line.id, line.quantity - 1)}>-</button>
                <span>{line.quantity}</span>
                <button onClick={() => updateQuantity(line.id, line.quantity + 1)}>+</button>
              </div>
              <span>₹{(line.quantity * (line.product?.price ?? 0)).toFixed(2)}</span>
              <button className="remove-btn" onClick={() => removeFromCart(line.id)}>
                ✕
              </button>
            </div>
          ))}
          <div className="cart-total" style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>Total: ₹{total.toFixed(2)}</strong>
            <button className="checkout-btn" onClick={handleCheckout} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>
              Checkout
            </button>
          </div>
        </>
      )}
    </div>
  )
}
