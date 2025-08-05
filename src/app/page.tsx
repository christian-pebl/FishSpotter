
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { getAllUsersWithTags, getAllVideos } from "@/lib/firestore"
import { createVideoDocument } from "@/lib/actions"
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
import { useToast } from "@/hooks/use-toast"
import { v4 as uuidv4 } from "uuid"
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { storage } from "@/lib/firebase"


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
    if (!authLoading && !user) {
      router.push('/login')
    }
    // We no longer redirect non-admins, they just get a read-only view
  }, [user, authLoading, router])
  
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
    if (!authLoading) {
      setLoadingData(true)
      fetchAdminData().finally(() => setLoadingData(false))
    }
  }, [authLoading, fetchAdminData])

  const addLog = (videoId: string, log: string) => {
      setUploadingVideos(prev => prev.map(v => v.id === videoId ? { ...v, logs: [...(v.logs || []), `${new Date().toLocaleTimeString()}: ${log}`] } : v));
  };
  
  const handleUpload = (files: FileList) => {
    if (!isAdmin) {
        toast({
            variant: "destructive",
            title: "Permission Denied",
            description: "You must be an admin to upload videos.",
        });
        return;
    }

    setIsUploadDialogOpen(false);
    
    const newVideos: UploadingVideo[] = Array.from(files).map(file => ({
      id: uuidv4(),
      name: file.name,
      status: 'uploading',
      progress: 0,
      speed: 0,
      logs: [`${new Date().toLocaleTimeString()}: Upload queued.`],
      file: file,
    }));

    setUploadingVideos(prev => [...newVideos, ...prev]);

    newVideos.forEach(video => {
      if (!video.file) return;

      const videoId = video.id;
      const file = video.file;

      const filePath = `videos/${uuidv4()}-${file.name}`;
      const storageRef = ref(storage, filePath);
      
      addLog(videoId, `Generated file path: ${filePath}`);
      addLog(videoId, "Storage reference created. Starting upload task...");
      
      const uploadTask = uploadBytesResumable(storageRef, file);
      
      let lastBytesTransferred = 0;
      let lastTimestamp = Date.now();

      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          const now = Date.now();
          const timeDiff = (now - lastTimestamp) / 1000;
          const bytesDiff = snapshot.bytesTransferred - lastBytesTransferred;
          const speed = timeDiff > 0 ? (bytesDiff / 1024) / timeDiff : 0;

          setUploadingVideos(prev => prev.map(v => v.id === videoId ? { ...v, progress, speed } : v));
          
          lastBytesTransferred = snapshot.bytesTransferred;
          lastTimestamp = now;

          switch (snapshot.state) {
            case 'paused':
              addLog(videoId, 'Upload is paused.');
              break;
            case 'running':
              // Log is too noisy, progress bar and speed are sufficient
              break;
          }
        },
        (error) => {
          console.error('Upload failed:', error);
          const errorMsg = `Upload failed: ${error.code} - ${error.message}`;
          addLog(videoId, errorMsg);
          setUploadingVideos(prev => prev.map(v => v.id === videoId ? { ...v, status: 'error', progress: 0, speed: 0 } : v));
          toast({
              variant: "destructive",
              title: "Upload failed",
              description: `Could not upload "${video.name}". Check logs for details.`,
          });
        },
        async () => {
          addLog(videoId, "Upload finished. Getting download URL...");
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            addLog(videoId, "Download URL retrieved successfully.");
            
            addLog(videoId, "Creating video document in database...");
            const videoDoc = await createVideoDocument({
              title: file.name.replace(/\.[^/.]+$/, ""),
              srcUrl: downloadURL,
              thumbnailUrl: "https://placehold.co/160x90.png",
              duration: 0, // Should be updated later
            });

            setUploadingVideos(prev => prev.map(v => v.id === videoId ? { ...v, status: 'complete', progress: 100, speed: 0 } : v));
            addLog(videoId, `Video "${videoDoc.title}" successfully added to database.`);
            setVideos(prev => [...prev, videoDoc].sort((a,b) => a.title.localeCompare(b.title)));
            toast({
              title: "Upload successful",
              description: `"${videoDoc.title}" has been added to the library.`,
            });
          } catch (error: any) {
            console.error('Post-upload process error:', error);
            const errorMsg = `Error creating database entry: ${error.message}`;
            addLog(videoId, errorMsg);
            setUploadingVideos(prev => prev.map(v => (v.id === videoId ? { ...v, status: 'error', progress: 0, speed: 0 } : v)));
            toast({
                variant: "destructive",
                title: "Upload failed",
                description: `Video uploaded but failed to save to database. Check logs.`,
            });
          }
        }
      );
    });
  };

  const handleRenameVideo = (id: string, newName: string) => {
    console.log(`Renaming ${id} to ${newName}`);
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
  
  if (!user) {
    return null; // Should be redirected by the useEffect
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
                  {!usersWithTags || usersWithTags.length === 0 ? (
                     <div className="flex flex-col items-center justify-center gap-2 text-center text-muted-foreground border-2 border-dashed rounded-lg p-8 h-full">
                        <UserIcon className="h-10 w-10" />
                        <h3 className="font-semibold">No User Data</h3>
                        <p className="text-sm">No user submissions have been recorded yet.</p>
                    </div>
                  ) : (
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
                  )}
                </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                      <CardTitle>Video Library</CardTitle>
                      <CardDescription>Manage and upload new videos for tagging.</CardDescription>
                  </div>
                  <Button onClick={() => setIsUploadDialogOpen(true)} disabled={!isAdmin}>
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
                         {!isAdmin && <p className="text-sm">You must be an admin to upload.</p>}
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
