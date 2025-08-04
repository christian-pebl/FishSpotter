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
  signup: (name: string, email: string, pass: string) => User
  logout: () => void
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined)

const MOCK_USERS: User[] = [
  { id: "user-1", name: "MarineExplorer", email: "user@critterpedia.com", role: "user" },
  { id: "admin-1", name: "Admin Coral", email: "admin@critterpedia.com", role: "admin" },
]

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null)
  const [users, setUsers] = React.useState<User[]>(MOCK_USERS);

  const login = (email: string, pass: string): User => {
    // This is mock authentication. In a real app, you'd call an API.
    const foundUser = users.find(u => u.email.toLowerCase() === email.toLowerCase())
    
    if (foundUser) {
      setUser(foundUser)
      return foundUser
    } else {
      throw new Error("Invalid email or password")
    }
  }

  const signup = (name: string, email: string, pass: string): User => {
    const existingUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existingUser) {
      throw new Error("An account with this email already exists.");
    }
    
    if (!name || !email || !pass) {
        throw new Error("Please fill in all fields.");
    }

    const newUser: User = {
      id: `user-${Date.now()}`,
      name,
      email,
      role: 'user'
    };

    setUsers(prev => [...prev, newUser]);
    return newUser;
  }

  const logout = () => {
    setUser(null)
  }

  const value = { user, login, signup, logout }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = React.useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
