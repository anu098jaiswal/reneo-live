import { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { CartProvider } from './context/CartContext'
import SignIn from './pages/SignIn'
import SignUp from './pages/SignUp'
import SellerDashboard from './pages/SellerDashboard'
import CustomerFeed from './pages/CustomerFeed'
import ErrorBanner from './components/ErrorBanner'

function AppRoutes() {
  const { profile, loading, sessionExpired, clearSessionExpired, signOut } = useAuth()
  const [showSignUp, setShowSignUp] = useState(false)

  if (loading) return <div className="center">Loading...</div>

  if (!profile) {
    return (
      <div className="auth-screen">
        {sessionExpired && (
          <ErrorBanner
            message="Your session expired. Please sign in again."
            onRetry={clearSessionExpired}
          />
        )}
        {showSignUp ? <SignUp /> : <SignIn />}
        <button className="link-btn" onClick={() => setShowSignUp(s => !s)}>
          {showSignUp ? 'Already have an account? Sign in' : 'New here? Sign up'}
        </button>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header>
        <p>
          Welcome, {profile.name} <span className="role-badge">{profile.role}</span>
        </p>
        <button onClick={signOut}>Sign out</button>
      </header>

      <main>{profile.role === 'seller' ? <SellerDashboard /> : <CustomerFeed />}</main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <AppRoutes />
      </CartProvider>
    </AuthProvider>
  )
}
