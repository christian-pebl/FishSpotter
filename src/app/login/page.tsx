
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const { login, signup } = useAuth()
  const { toast } = useToast()
  
  const [isSignUp, setIsSignUp] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)
  
  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")

  const handleAuthAction = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      if (isSignUp) {
        const user = await signup(name, email, password)
        toast({
          title: "Sign Up Successful",
          description: `Welcome, ${user.name}! Please log in.`,
        })
        // Switch to login form after successful signup
        setIsSignUp(false)
        setName("")
        setEmail("")
        setPassword("")
      } else {
        const user = await login(email, password)
        toast({
          title: "Login Successful",
          description: `Welcome back, ${user.name}!`,
        })
        if (user.role === 'admin') {
          router.push("/admin")
        } else {
          router.push("/")
        }
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: isSignUp ? "Sign Up Failed" : "Login Failed",
        description: error.message,
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div 
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4"
      style={{
        backgroundImage: `url(/background.png)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-white/30 backdrop-blur-sm"></div>
      
      <Card className="z-10 w-full max-w-sm border-white/20 bg-white/20 backdrop-blur-lg">
        <form onSubmit={handleAuthAction}>
          <CardHeader className="items-center text-center">
            <CardTitle className="font-headline text-3xl font-bold text-foreground">{isSignUp ? 'Create Account' : 'Welcome to Critterpedia'}</CardTitle>
            <CardDescription className="text-foreground/80">{isSignUp ? 'Join our community of marine enthusiasts.' : 'Enter your credentials to start tagging.'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="name" className="text-foreground/90">Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Deep Sea Diver"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="border-white/30 bg-white/30 placeholder:text-foreground/60"
                  disabled={isLoading}
                />
              </div>
            )}
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
                disabled={isLoading}
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
                disabled={isLoading}
              />
            </div>
          </CardContent>
          <CardFooter className="flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSignUp ? 'Sign Up' : 'Sign In'}
            </Button>
            <Button type="button" variant="link" className="text-foreground/80" onClick={() => setIsSignUp(!isSignUp)} disabled={isLoading}>
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </Button>
            <p className={cn("text-xs text-foreground/70", isSignUp && 'hidden')}>
              Hint: use `admin@critterpedia.com` or `user@critterpedia.com` with any password.
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
