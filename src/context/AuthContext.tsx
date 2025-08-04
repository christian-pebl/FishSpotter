"use client"

import * as React from "react"

interface User {
  id: string
  name: string
  email: string
  role: "user" | "admin"
}

interface AuthContextType {
  user: User | null
  login: (email: string, pass: string) => User
  logout: () => void
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined)

const MOCK_USERS: User[] = [
  { id: "user-1", name: "MarineExplorer", email: "user@critterpedia.com", role: "user" },
  { id: "admin-1", name: "Admin Coral", email: "admin@critterpedia.com", role: "admin" },
]

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null)

  const login = (email: string, pass: string): User => {
    // This is mock authentication. In a real app, you'd call an API.
    const foundUser = MOCK_USERS.find(u => u.email.toLowerCase() === email.toLowerCase())
    
    if (foundUser) {
      setUser(foundUser)
      return foundUser
    } else {
      throw new Error("Invalid email or password")
    }
  }

  const logout = () => {
    setUser(null)
  }

  const value = { user, login, logout }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = React.useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
