"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AppLogo } from "@/components/icons"
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
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <form onSubmit={handleLogin}>
          <CardHeader className="items-center text-center">
            <AppLogo className="mb-2 h-10 w-10 text-primary" />
            <CardTitle className="font-headline text-2xl">Welcome to Critterpedia</CardTitle>
            <CardDescription>Enter your credentials to start tagging.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter className="flex-col gap-4">
            <Button type="submit" className="w-full">
              Sign In
            </Button>
             <p className="text-xs text-muted-foreground">
              Hint: use `admin@critterpedia.com` or `user@critterpedia.com` with any password.
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
