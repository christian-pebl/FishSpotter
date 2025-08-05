
"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { UserCircle, LogOut, Loader2, ListVideo, ShieldCheck, LayoutDashboard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import VideoProgressSheet from "./video-progress-sheet"
import AdminLoginDialog from "./admin-login-dialog"
import type { Video, Tag } from "@/lib/types"

interface AppHeaderProps {
  videos?: Video[];
  allTags?: Tag[];
  submittedVideoIds?: Set<string>;
  onVideoSelect?: (index: number) => void;
}

export default function AppHeader({ videos, allTags, submittedVideoIds, onVideoSelect }: AppHeaderProps) {
  const { user, logout, loading, isAdmin, grantAdminAccess } = useAuth()
  const router = useRouter()
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [isAdminDialogOpen, setIsAdminDialogOpen] = React.useState(false);

  const handleLogout = async () => {
    try {
      await logout()
      router.push("/login")
    } catch (error) {
      console.error(error)
      // Handle logout error with a toast, perhaps
    }
  }

  const handleAdminLoginSuccess = () => {
    grantAdminAccess();
    router.push("/");
  }

  return (
    <>
      <AdminLoginDialog
        isOpen={isAdminDialogOpen}
        onOpenChange={setIsAdminDialogOpen}
        onSuccess={handleAdminLoginSuccess}
      />
      <header className="flex h-16 shrink-0 items-center justify-between border-b px-4 lg:px-6">
        <Link href="/" className="flex items-center gap-2">
          <h1 className="font-headline text-xl font-bold tracking-tight">Fish Spotter</h1>
        </Link>
        <div className="flex items-center gap-2">
          {user && videos && onVideoSelect && (
             <VideoProgressSheet 
              videos={videos}
              allTags={allTags || []}
              submittedVideoIds={submittedVideoIds || new Set()}
              currentUser={user}
              onVideoSelect={onVideoSelect}
              isOpen={isSheetOpen}
              onOpenChange={setIsSheetOpen}
            />
          )}
          {loading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <UserCircle className="h-6 w-6" />
                  <span className="sr-only">Toggle user menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Hi, {user.name}!</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {isAdmin && (
                  <DropdownMenuItem onClick={() => router.push('/')}>
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    <span>Dashboard</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem>Profile</DropdownMenuItem>
                <DropdownMenuItem>Settings</DropdownMenuItem>
                {!isAdmin && (
                  <DropdownMenuItem onClick={() => setIsAdminDialogOpen(true)}>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    <span>Admin Log in</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button onClick={() => router.push('/login')}>Login</Button>
          )}
        </div>
      </header>
    </>
  )
}
