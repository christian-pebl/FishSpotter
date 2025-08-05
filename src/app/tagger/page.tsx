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
  const { login, signup, forgotPassword } = useAuth()
  const { toast } = useToast()
  
  const [authMode, setAuthMode] = React.useState<'login' | 'signup' | 'forgotPassword'>('login')
  const [isLoading, setIsLoading] = React.useState(false)
  
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")

  const handleAuthAction = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      if (authMode === 'signup') {
        const user = await signup(email, password)
        toast({
          title: "Sign Up Successful",
          description: `Welcome, ${user.name}! Please log in.`,
        })
        setAuthMode('login')
        setEmail("")
        setPassword("")
      } else if (authMode === 'login') {
        await login(email, password)
        toast({
          title: "Login Successful",
          description: `Welcome back!`,
        })
        router.push("/")
      } else if (authMode === 'forgotPassword') {
        await forgotPassword(email)
        toast({
          title: "Password Reset Email Sent",
          description: "Please check your inbox for instructions to reset your password.",
        })
        setAuthMode('login')
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: authMode === 'signup' ? "Sign Up Failed" : authMode === 'login' ? "Login Failed" : "Request Failed",
        description: error.message,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getTitle = () => {
    if (authMode === 'signup') return 'Create Account'
    if (authMode === 'forgotPassword') return 'Reset Password'
    return 'Welcome to Abyssal Annotator'
  }
  
  const getDescription = () => {
    if (authMode === 'signup') return 'Join our community of marine enthusiasts.'
    if (authMode === 'forgotPassword') return "Enter your email to receive a reset link."
    return 'Enter your credentials to start tagging.'
  }

  const getButtonText = () => {
    if (authMode === 'signup') return 'Sign Up'
    if (authMode === 'forgotPassword') return 'Send Reset Link'
    return 'Sign In'
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
            <CardTitle className="font-headline text-3xl font-bold text-foreground">{getTitle()}</CardTitle>
            <CardDescription className="text-foreground/80">{getDescription()}</CardDescription>
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
                disabled={isLoading}
              />
            </div>
            {authMode !== 'forgotPassword' && (
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
            )}
          </CardContent>
          <CardFooter className="flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isLoading || (authMode === 'login' && (!email || !password))}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {getButtonText()}
            </Button>
            
            {authMode === 'login' && (
                 <div className="flex w-full justify-between">
                     <Button type="button" variant="link" className="text-foreground/80 px-0" onClick={() => setAuthMode('forgotPassword')} disabled={isLoading}>
                         Forgot Password?
                     </Button>
                     <Button type="button" variant="link" className="text-foreground/80 px-0" onClick={() => setAuthMode('signup')} disabled={isLoading}>
                         Don't have an account? Sign Up
                     </Button>
                 </div>
             )}

            {authMode !== 'login' && (
                 <Button type="button" variant="link" className="text-foreground/80" onClick={() => setAuthMode('login')} disabled={isLoading}>
                     Back to Sign In
                 </Button>
             )}
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}