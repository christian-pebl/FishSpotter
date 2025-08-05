
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
import { Loader2, User as UserIcon, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import UploadDialog from "@/components/upload-dialog"
import VideoQueue, { type UploadingVideo } from "@/components/video-queue"

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
  const [isUploadDialogOpen, setIsUploadDialogOpen] = React.useState(false)
  const [uploadingVideos, setUploadingVideos] = React.useState<UploadingVideo[]>([]);


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
  
  const handleUpload = (files: FileList) => {
    const newVideos: UploadingVideo[] = Array.from(files).map(file => ({
      id: `upload-${Date.now()}-${Math.random()}`,
      name: file.name,
      status: 'uploading',
      progress: 0,
    }));

    setUploadingVideos(prev => [...prev, ...newVideos]);
    setIsUploadDialogOpen(false);

    newVideos.forEach(video => {
      // Simulate upload progress
      const interval = setInterval(() => {
        setUploadingVideos(prev =>
          prev.map(v =>
            v.id === video.id
              ? { ...v, progress: Math.min(v.progress + 10, 100) }
              : v
          )
        );
      }, 200);

      setTimeout(() => {
        clearInterval(interval);
        setUploadingVideos(prev =>
          prev.map(v =>
            v.id === video.id ? { ...v, status: 'complete', progress: 100 } : v
          )
        );
      }, 2200);
    });
  };

  const handleRenameVideo = (id: string, newName: string) => {
    setUploadingVideos(prev => prev.map(v => v.id === id ? { ...v, name: newName } : v));
  };
  
  const handleDeleteVideo = (id: string) => {
    setUploadingVideos(prev => prev.filter(v => v.id !== id));
  };

  const getVideoTitleById = (videoId: string) => {
    return videos.find(v => v.id === videoId)?.title || "Unknown Video"
  }
  
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
       <UploadDialog 
        isOpen={isUploadDialogOpen}
        onOpenChange={setIsUploadDialogOpen}
        onUpload={handleUpload}
      />
      <AppHeader />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6">
            <h1 className="font-headline text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground">Overview of user contributions and video library.</p>
          </div>
          
           <div className="grid gap-6 md:grid-cols-2">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>User Submissions</CardTitle>
                    <CardDescription>Click on a user to see their submitted tags.</CardDescription>
                </div>
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
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                      <CardTitle>Video Library</CardTitle>
                      <CardDescription>Manage and upload new videos for tagging.</CardDescription>
                  </div>
                  <Button onClick={() => setIsUploadDialogOpen(true)}>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Videos
                  </Button>
              </CardHeader>
              <CardContent>
                <VideoQueue 
                  videos={uploadingVideos}
                  onRename={handleRenameVideo}
                  onDelete={handleDeleteVideo}
                />
              </CardContent>
            </Card>
           </div>
        </div>
      </main>
    </div>
  )
}
