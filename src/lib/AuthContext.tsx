import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

interface AuthContextType {
  user:      User | null
  session:   Session | null
  role:      'admin' | 'perito' | 'cliente' | null
  name:      string | null
  clientId:  string | null
  loading:   boolean
  signOut:   () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null, session: null, role: null, name: null, clientId: null, loading: true,
  signOut: async () => {}
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<{ name: string; role: string; client_id: string | null } | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('name, role, client_id')
      .eq('id', userId)
      .single()
    setProfile(data || null)
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      if (data.session?.user) await loadProfile(data.session.user.id)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_e, s) => {
      setSession(s)
      if (s?.user) {
        await loadProfile(s.user.id)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const user     = session?.user ?? null
  const role     = (profile?.role as 'admin' | 'perito' | 'cliente') ?? null
  const name     = profile?.name ?? null
  const clientId = profile?.client_id ?? null

  async function signOut() {
    await supabase.auth.signOut()
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ user, session, role, name, clientId, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() { return useContext(AuthContext) }
