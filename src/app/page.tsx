
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import AppHeader from "@/components/app-header"
import { Loader2 } from "lucide-react"

export default function HomePage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  React.useEffect(() => {
    if (!loading) {
      if (user) {
        router.replace("/tagger")
      } else {
        router.replace("/login")
      }
    }
  }, [user, loading, router])

  return (
    <div className="flex h-screen w-full flex-col bg-background">
      <AppHeader />
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Loading...</p>
      </div>
    </div>
  )
}
