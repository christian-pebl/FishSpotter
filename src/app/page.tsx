
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useSupabaseAuth } from "@/context/SupabaseAuthContext"
import { Loader2 } from "lucide-react"

export default function HomePage() {
  const { user, loading } = useSupabaseAuth()
  const router = useRouter()

  React.useEffect(() => {
    if (!loading) {
      if (user) {
        router.replace('/tagger')
      } else {
        router.replace('/login')
      }
    }
  }, [user, loading, router])

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  )
}
