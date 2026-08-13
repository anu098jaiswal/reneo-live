import { useCart } from '../context/CartContext'

interface Props {
  onClose: () => void
}

export default function CartDrawer({ onClose }: Props) {
  const { lines, total, updateQuantity, removeFromCart, error } = useCart()

  return (
    <div className="cart-drawer">
      <div className="cart-header">
        <h3>Your cart</h3>
        <button onClick={onClose}>Close</button>
      </div>

      {error && <p className="error">{error}</p>}

      {lines.length === 0 ? (
        <p>Your cart is empty.</p>
      ) : (
        <>
          {lines.map(line => (
            <div key={line.id} className="cart-line">
              <span>{line.product.name}</span>
              <div className="qty-controls">
                <button onClick={() => updateQuantity(line.id, line.quantity - 1)}>-</button>
                <span>{line.quantity}</span>
                <button onClick={() => updateQuantity(line.id, line.quantity + 1)}>+</button>
              </div>
              <span>₹{(line.quantity * line.product.price).toFixed(2)}</span>
              <button className="remove-btn" onClick={() => removeFromCart(line.id)}>
                ✕
              </button>
            </div>
          ))}
          <div className="cart-total">
            <strong>Total: ₹{total.toFixed(2)}</strong>
          </div>
        </>
      )}
    </div>
  )
}
