"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()
  const { toast } = useToast()
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const user = login(email, password)
      toast({
        title: "Login Successful",
        description: `Welcome back, ${user.name}!`,
      })
      if (user.role === 'admin') {
        router.push("/admin")
      } else {
        router.push("/")
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: error.message,
      })
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
       <div className="absolute inset-0 z-0 bg-gradient-to-br from-cyan-200 via-blue-300 to-indigo-400 opacity-80" />
        <div className="absolute -bottom-1/4 -left-1/4 h-1/2 w-1/2 rounded-full bg-gradient-to-r from-blue-400 to-transparent opacity-30 blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute -top-1/4 -right-1/4 h-1/2 w-1/2 rounded-full bg-gradient-to-l from-cyan-400 to-transparent opacity-30 blur-3xl animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }} />
        <div className="absolute bottom-1/4 right-1/4 h-1/3 w-1/3 rounded-full bg-gradient-to-t from-indigo-500 to-transparent opacity-20 blur-3xl animate-pulse" style={{ animationDuration: '12s', animationDelay: '4s' }} />
      
      <Card className="z-10 w-full max-w-sm border-white/20 bg-white/20 backdrop-blur-lg">
        <form onSubmit={handleLogin}>
          <CardHeader className="items-center text-center">
            <CardTitle className="font-headline text-3xl font-bold text-foreground">Welcome to Critterpedia</CardTitle>
            <CardDescription className="text-foreground/80">Enter your credentials to start tagging.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground/90">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border-white/30 bg-white/30 placeholder:text-foreground/60"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground/90">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border-white/30 bg-white/30 placeholder:text-foreground/60"
              />
            </div>
          </CardContent>
          <CardFooter className="flex-col gap-4">
            <Button type="submit" className="w-full">
              Sign In
            </Button>
             <p className="text-xs text-foreground/70">
              Hint: use `admin@critterpedia.com` or `user@critterpedia.com` with any password.
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
