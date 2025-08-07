"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import type { User as SupabaseUser } from '@supabase/supabase-js'

interface User {
  id: string
  name: string
  email: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, pass: string) => Promise<User>
  signup: (email: string, pass: string) => Promise<User>
  logout: () => Promise<void>
  forgotPassword: (email: string) => Promise<void>
}

const SupabaseAuthContext = React.createContext<AuthContextType | undefined>(undefined)

export function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null)
  const [loading, setLoading] = React.useState(true)
  const router = useRouter();

  React.useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session?.user) {
        await handleUserSession(session.user)
      }
      
      setLoading(false)
    }

    getInitialSession()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔐 Supabase auth event:', event)
      
      if (session?.user) {
        await handleUserSession(session.user)
      } else {
        setUser(null)
      }
      
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleUserSession = async (supabaseUser: SupabaseUser) => {
    try {
      // Check if user profile exists in our users table
      console.log('🔍 Fetching user profile for ID:', supabaseUser.id)
      const { data: profile, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', supabaseUser.id)
        .single()
      
      console.log('👤 Profile query result:', { profile, error })
      
      if (error) {
        console.error('❌ Error fetching user profile:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        })
        
        if (error.code !== 'PGRST116') { // PGRST116 = not found
          console.error('🚫 Database query failed with code:', error.code)
          // Don't return here - try to create the profile instead
        }
      }

      if (profile) {
        // User profile exists
        console.log('✅ Using existing profile:', profile)
        setUser({
          id: profile.id,
          name: profile.name,
          email: profile.email
        })
      } else {
        // Create user profile or use a fallback
        const name = supabaseUser.email?.split('@')[0] || 'User'
        const fallbackProfile = {
          id: supabaseUser.id,
          name,
          email: supabaseUser.email || ''
        }

        console.log('🔄 Attempting to create user profile:', fallbackProfile)
        
        const { error: insertError } = await supabase
          .from('users')
          .insert(fallbackProfile)

        if (insertError) {
          console.error('❌ Error creating user profile:', insertError)
          console.log('🔧 Using fallback profile without database storage')
          // Use fallback profile even if database insert fails
          setUser(fallbackProfile)
          return
        }

        console.log('✅ Profile created successfully')
        setUser(fallbackProfile)
      }
    } catch (error) {
      console.error('Error handling user session:', error)
    }
  }

  const login = async (email: string, pass: string): Promise<User> => {
    try {
      console.log('🔐 Attempting Supabase login...')
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: pass,
      })

      if (error) {
        console.error('Supabase login error:', error)
        throw new Error(error.message)
      }

      if (!data.user) {
        throw new Error('No user data returned')
      }

      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single()

      if (profileError) {
        console.error('Error fetching user profile:', profileError)
        throw new Error('Failed to fetch user profile')
      }

      const userData: User = {
        id: profile.id,
        name: profile.name,
        email: profile.email
      }

      setUser(userData)
      console.log('✅ Login successful:', userData)
      return userData

    } catch (error: any) {
      console.error("Login Error:", error)
      throw new Error(error.message || "Failed to login.")
    }
  }

  const signup = async (email: string, pass: string): Promise<User> => {
    try {
      console.log('🔐 Attempting Supabase signup...')
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password: pass,
      })

      if (error) {
        console.error('Supabase signup error:', error)
        throw new Error(error.message)
      }

      if (!data.user) {
        throw new Error('No user data returned')
      }

      const name = email.split('@')[0]
      
      const newUser: User = {
        id: data.user.id,
        name,
        email,
      }

      // Insert user profile (will be handled by handleUserSession too, but this ensures it's immediate)
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: data.user.id,
          name,
          email,
        })

      if (profileError) {
        console.error('Error creating user profile:', profileError)
        // Don't throw here as auth was successful
      }

      console.log('✅ Signup successful:', newUser)
      return newUser

    } catch (error: any) {
      console.error("Signup Error:", error)
      throw new Error(error.message || "Failed to sign up.")
    }
  }
  
  const forgotPassword = async (email: string): Promise<void> => {
    try {
      console.log('🔐 Sending password reset email...')
      
      const { error } = await supabase.auth.resetPasswordForEmail(email)
      
      if (error) {
        console.error('Password reset error:', error)
        throw new Error(error.message)
      }
      
      console.log('✅ Password reset email sent')

    } catch (error: any) {
      console.error("Forgot Password Error:", error)
      throw new Error(error.message || "Failed to send password reset email.")
    }
  }

  const logout = async () => {
    try {
      console.log('🔐 Logging out...')
      
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        console.error('Logout error:', error)
        throw new Error(error.message)
      }
      
      setUser(null)
      router.push("/")
      console.log('✅ Logout successful')
      
    } catch (error: any) {
      console.error("Logout Error:", error)
      throw new Error("Failed to logout.")
    }
  }

  const value = { user, loading, login, signup, logout, forgotPassword }

  return <SupabaseAuthContext.Provider value={value}>{children}</SupabaseAuthContext.Provider>
}

export function useSupabaseAuth() {
  const context = React.useContext(SupabaseAuthContext)
  if (context === undefined) {
    throw new Error("useSupabaseAuth must be used within a SupabaseAuthProvider")
  }
  return context
}