
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { getAllUsersWithTags, getAllVideos } from "@/lib/firestore"
import type { User, Tag, Video } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { formatTimestamp } from "@/lib/utils"
import AppHeader from "@/components/app-header"
import { Loader2, User as UserIcon, Video as VideoIcon } from "lucide-react"

interface UserWithTags extends User {
  tags: Tag[]
  submittedVideoIds: Set<string>
}

export default function AdminDashboardPage() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const router = useRouter()

  const [usersWithTags, setUsersWithTags] = React.useState<UserWithTags[]>([])
  const [videos, setVideos] = React.useState<Video[]>([])
  const [loadingData, setLoadingData] = React.useState(true)

  React.useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push('/')
    }
  }, [user, isAdmin, authLoading, router])

  React.useEffect(() => {
    if (isAdmin) {
      const fetchData = async () => {
        setLoadingData(true)
        try {
          const [fetchedUsers, fetchedVideos] = await Promise.all([
            getAllUsersWithTags(),
            getAllVideos(),
          ])
          
          const usersData = fetchedUsers.map(u => ({
            ...u,
            submittedVideoIds: new Set(u.tags.map(t => t.videoId))
          }))

          setUsersWithTags(usersData)
          setVideos(fetchedVideos)
        } catch (error) {
          console.error("Failed to fetch admin data:", error)
          // Handle error with a toast
        } finally {
          setLoadingData(false)
        }
      }
      fetchData()
    }
  }, [isAdmin])

  const getVideoTitleById = (videoId: string) => {
    return videos.find(v => v.id === videoId)?.title || "Unknown Video"
  }
  
  const totalSubmittedVideos = usersWithTags.reduce((acc, user) => acc + user.submittedVideoIds.size, 0);


  if (authLoading || loadingData) {
    return (
      <div className="flex h-screen w-full flex-col bg-background">
        <AppHeader />
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="ml-2">Loading Dashboard...</p>
        </div>
      </div>
    )
  }
  
  if (!isAdmin) {
    return null; // or a redirection component
  }

  return (
    <div className="flex h-screen w-full flex-col bg-background">
      <AppHeader />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6">
            <h1 className="font-headline text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground">Overview of user contributions and submitted tags.</p>
          </div>
          
           <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <UserIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{usersWithTags.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Submitted Videos</CardTitle>
                 <VideoIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalSubmittedVideos}</div>
              </CardContent>
            </Card>
           </div>


          <Card>
            <CardHeader>
              <CardTitle>User Submissions</CardTitle>
              <CardDescription>Click on a user to see their submitted tags.</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {usersWithTags.map((u) => (
                  <AccordionItem value={u.id} key={u.id}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex w-full items-center justify-between pr-4">
                        <span className="font-medium">{u.name} ({u.email})</span>
                        <Badge variant="secondary">{u.submittedVideoIds.size} {u.submittedVideoIds.size === 1 ? 'video' : 'videos'} submitted</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      {u.tags.length > 0 ? (
                        <div className="p-2 bg-muted/50 rounded-md">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Video</TableHead>
                                <TableHead>Timestamp</TableHead>
                                <TableHead>Tag Text</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {u.tags.map((tag) => (
                                <TableRow key={tag.id}>
                                  <TableCell className="font-medium">{getVideoTitleById(tag.videoId)}</TableCell>
                                  <TableCell>{formatTimestamp(tag.timestamp)}</TableCell>
                                  <TableCell>{tag.text}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <p className="p-4 text-center text-sm text-muted-foreground">This user has not submitted any tags yet.</p>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
