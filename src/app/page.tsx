
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { Loader2 } from "lucide-react"

export default function TaggerPage() {
  const { loading } = useAuth()
  const router = useRouter()

  React.useEffect(() => {
    if (!loading) {
      router.replace('/admin')
    }
  }, [loading, router])

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Redirecting to admin dashboard...</p>
    </div>
  )
}
