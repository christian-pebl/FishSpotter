
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
import VideoPreviewDialog from "@/components/video-preview-dialog"
import { FileVideo, Play } from "lucide-react"
import { uploadVideo } from "@/lib/actions"
import { useToast } from "@/hooks/use-toast"


interface UserWithTags extends User {
  tags: Tag[]
  submittedVideoIds: Set<string>
}

export default function AdminDashboardPage() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  const [usersWithTags, setUsersWithTags] = React.useState<UserWithTags[]>([])
  const [videos, setVideos] = React.useState<Video[]>([])
  const [loadingData, setLoadingData] = React.useState(true)
  const [isUploadDialogOpen, setIsUploadDialogOpen] = React.useState(false)
  const [uploadingVideos, setUploadingVideos] = React.useState<UploadingVideo[]>([]);
  const [previewVideo, setPreviewVideo] = React.useState<Video | null>(null)


  React.useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push('/')
    }
  }, [user, isAdmin, authLoading, router])
  
  const fetchAdminData = React.useCallback(async () => {
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
        setVideos(fetchedVideos.sort((a,b) => a.title.localeCompare(b.title)))
      } catch (error) {
        console.error("Failed to fetch admin data:", error)
      } 
  }, [])


  React.useEffect(() => {
    if (isAdmin) {
      setLoadingData(true)
      fetchAdminData().finally(() => setLoadingData(false))
    }
  }, [isAdmin, fetchAdminData])
  
  const handleUpload = (files: FileList) => {
    setIsUploadDialogOpen(false);
    
    const newVideos: UploadingVideo[] = Array.from(files).map(file => ({
      id: `upload-${file.name}-${Date.now()}`,
      name: file.name,
      status: 'uploading',
      progress: 0,
      file: file,
    }));

    setUploadingVideos(prev => [...newVideos, ...prev]);

    newVideos.forEach(async (video) => {
      if (!video.file) return;

      try {
        const formData = new FormData();
        formData.append('video', video.file);

        // This would be where you'd use a library that supports progress tracking
        // For now, we simulate progress based on the upload itself completing
        // A real implementation would involve a more complex setup with web sockets or polling
        
        setUploadingVideos(prev => prev.map(v => v.id === video.id ? { ...v, progress: 50 } : v));

        const result = await uploadVideo(formData);
        
        if (result.success && result.video) {
          setUploadingVideos(prev =>
            prev.map(v =>
              v.id === video.id ? { ...v, status: 'complete', progress: 100 } : v
            )
          );
          // Add new video to the list without re-fetching everything
          setVideos(prev => [...prev, result.video!].sort((a,b) => a.title.localeCompare(b.title)));
          toast({
            title: "Upload successful",
            description: `"${result.video.title}" has been added to the library.`,
          });
        } else {
          throw new Error(result.error || 'Upload failed');
        }

      } catch (error) {
        console.error('Upload error:', error);
        setUploadingVideos(prev =>
          prev.map(v => (v.id === video.id ? { ...v, status: 'error', progress: 0 } : v))
        );
        toast({
            variant: "destructive",
            title: "Upload failed",
            description: `Could not upload "${video.name}". Please try again.`,
        });
      }
    });
  };

  const handleRenameVideo = (id: string, newName: string) => {
    // In a real app, you'd call a server action here to rename the file/DB record
    console.log(`Renaming ${id} to ${newName}`);
  };
  
  const handleDeleteVideo = (id: string) => {
    // In a real app, you'd call a server action here to delete the file/DB record
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
      <VideoPreviewDialog
        video={previewVideo}
        isOpen={!!previewVideo}
        onOpenChange={(isOpen) => !isOpen && setPreviewVideo(null)}
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
                 {uploadingVideos.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-2">Upload Queue</h3>
                    <VideoQueue 
                      videos={uploadingVideos}
                      onRename={handleRenameVideo}
                      onDelete={handleDeleteVideo}
                    />
                  </div>
                )}
                
                <h3 className="text-lg font-semibold mb-2">Uploaded Videos</h3>
                 {videos.length > 0 ? (
                    <div className="space-y-2">
                      {videos.map(video => (
                        <div key={video.id} className="flex items-center gap-4 p-2 rounded-lg hover:bg-muted/50">
                          <FileVideo className="h-6 w-6 text-muted-foreground" />
                          <p className="flex-1 text-sm font-medium leading-none truncate">{video.title}</p>
                          <Button variant="ghost" size="icon" onClick={() => setPreviewVideo(video)} aria-label="Play video">
                            <Play className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 text-center text-muted-foreground border-2 border-dashed rounded-lg p-8 h-full">
                        <FileVideo className="h-10 w-10" />
                        <h3 className="font-semibold">No Videos Available</h3>
                        <p className="text-sm">Upload videos to start building your library.</p>
                    </div>
                  )}
              </CardContent>
            </Card>
           </div>
        </div>
      </main>
    </div>
  )
}
