import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile, Role } from '../types'

interface AuthContextType {
  profile: Profile | null
  loading: boolean
  sessionExpired: boolean
  clearSessionExpired: () => void
  signUp: (email: string, password: string, name: string, role: Role) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionExpired, setSessionExpired] = useState(false)
  const wasLoggedIn = useRef(false)
  const manualSignOut = useRef(false)

  async function loadProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Failed to load profile:', error.message)
      setProfile(null)
    } else {
      setProfile(data)
      wasLoggedIn.current = true
    }
  }

  useEffect(() => {
    // check for existing session on load
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadProfile(session.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    // listen for login/logout events — including an unexpected sign-out,
    // which is how Supabase surfaces an expired/invalid session (A11).
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        loadProfile(session.user.id)
      } else {
        if (event === 'SIGNED_OUT' && wasLoggedIn.current && !manualSignOut.current) {
          setSessionExpired(true)
        }
        manualSignOut.current = false
        wasLoggedIn.current = false
        setProfile(null)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function signUp(email: string, password: string, name: string, role: Role) {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    if (!data.user) throw new Error('Sign up succeeded but no user returned')

    // second call — create the profile row now that the auth user exists
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({ id: data.user.id, name, role })

    if (profileError) throw profileError
    await loadProfile(data.user.id)
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signOut() {
    manualSignOut.current = true
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    setProfile(null)
  }

  function clearSessionExpired() {
    setSessionExpired(false)
  }

  return (
    <AuthContext.Provider
      value={{ profile, loading, sessionExpired, clearSessionExpired, signUp, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
