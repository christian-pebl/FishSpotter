
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { 
  onAuthStateChanged, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  sendPasswordResetEmail,
  type User as FirebaseUser
} from "firebase/auth"
import { doc, setDoc, getDoc } from "firebase/firestore"
import { auth, db } from "@/lib/firebase"

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

const AuthContext = React.createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null)
  const [loading, setLoading] = React.useState(true)
  const router = useRouter();

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
        if (userDoc.exists()) {
          setUser({ id: firebaseUser.uid, ...userDoc.data() } as User);
        } else {
          // Handle case where user exists in Auth but not Firestore
          setUser(null);
        }
      } else {
        setUser(null)
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const login = async (email: string, pass: string): Promise<User> => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));
      if (!userDoc.exists()) {
        throw new Error("User data not found in database.");
      }
      const userData = { id: userCredential.user.uid, ...userDoc.data() } as User;
      setUser(userData);
      return userData;
    } catch (error: any) {
      console.error("Login Error:", error);
      // More specific error handling can be done here
      throw new Error(error.message || "Failed to login.");
    }
  }

  const signup = async (email: string, pass: string): Promise<User> => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      const firebaseUser = userCredential.user;
      
      const name = email.split('@')[0];

      const newUser: User = {
        id: firebaseUser.uid,
        name,
        email,
      };

      await setDoc(doc(db, "users", firebaseUser.uid), {
        name: newUser.name,
        email: newUser.email,
      });

      // We don't set user state here, onAuthStateChanged will handle it
      return newUser;
    } catch (error: any) {
      console.error("Signup Error:", error);
      throw new Error(error.message || "Failed to sign up.");
    }
  }
  
  const forgotPassword = async (email: string): Promise<void> => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
      console.error("Forgot Password Error:", error);
      throw new Error(error.message || "Failed to send password reset email.");
    }
  }

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      router.push("/login");
    } catch (error: any) {
      console.error("Logout Error:", error);
      throw new Error("Failed to logout.");
    }
  }

  const value = { user, loading, login, signup, logout, forgotPassword }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = React.useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
