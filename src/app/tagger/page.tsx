
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { getVideos, getTags, saveTags } from "@/lib/actions"
import type { Video, Tag } from "@/lib/types"
import AppHeader from "@/components/app-header"
import VideoPlayer, { type VideoPlayerRef } from "@/components/video-player"
import TaggingForm from "@/components/tagging-form"
import TagList from "@/components/tag-list"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Loader2, ArrowLeft, ArrowRight, Send } from "lucide-react"
import { v4 as uuidv4 } from 'uuid';
import LevelUpAnimation from "@/components/level-up-animation"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"

const TAGS_PER_LEVEL = 10;

export default function TaggerPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  
  const [videos, setVideos] = React.useState<Video[]>([])
  const [allTags, setAllTags] = React.useState<Tag[]>([])
  const [currentVideoIndex, setCurrentVideoIndex] = React.useState(0)
  const [loadingData, setLoadingData] = React.useState(true)
  const [selectedTimestamp, setSelectedTimestamp] = React.useState<number | null>(null)
  const [taggingPosition, setTaggingPosition] = React.useState<{x: number, y: number} | null>(null)
  const [activeTagId, setActiveTagId] = React.useState<string | null>(null)
  const [level, setLevel] = React.useState(1)
  const [showLevelUp, setShowLevelUp] = React.useState(false);
  const [submittedVideoIds, setSubmittedVideoIds] = React.useState<Set<string>>(new Set());

  const videoPlayerRef = React.useRef<VideoPlayerRef>(null)

  React.useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
    }
  }, [user, authLoading, router])

  React.useEffect(() => {
    async function fetchData() {
      if (!user) {
        setLoadingData(false); // No user, stop loading
        return;
      }
      try {
        setLoadingData(true)
        const [fetchedVideos, fetchedTags] = await Promise.all([getVideos(), getTags()])
        setVideos(fetchedVideos)
        setAllTags(fetchedTags)
        
        const userTags = fetchedTags.filter(t => t.userId === user.id)
        setLevel(Math.floor(userTags.length / TAGS_PER_LEVEL) + 1)

        const submittedIds = new Set(fetchedTags.filter(t => t.userId === user.id && t.submitted).map(t => t.videoId));
        setSubmittedVideoIds(submittedIds);

      } catch (error) {
        console.error("Failed to fetch data:", error)
        toast({ variant: "destructive", title: "Failed to load data" })
      } finally {
        setLoadingData(false)
      }
    }
    // Fetch data only when auth is done and we have a user
    if (!authLoading && user) {
      fetchData()
    }
  }, [user, authLoading, toast])

  const currentVideo = videos[currentVideoIndex]
  const tagsForCurrentVideo = React.useMemo(() => {
    if (!currentVideo) return []
    return allTags
      .filter((tag) => tag.videoId === currentVideo.id)
      .sort((a, b) => a.timestamp - b.timestamp)
  }, [allTags, currentVideo])
  
  const userTagsForCurrentVideo = React.useMemo(() => {
     if (!currentVideo || !user) return []
     return tagsForCurrentVideo.filter(tag => tag.userId === user.id);
  }, [tagsForCurrentVideo, currentVideo, user]);

  const activeTag = React.useMemo(() => {
    return allTags.find(tag => tag.id === activeTagId) ?? null;
  }, [allTags, activeTagId]);


  const handleTimestampSelect = (time: number, position: {x: number, y: number}) => {
    setSelectedTimestamp(time)
    setTaggingPosition(position)
    setActiveTagId(null)
  }

  const handleCancelTag = () => {
    setSelectedTimestamp(null)
    setTaggingPosition(null)
    setActiveTagId(null)
  }

  const handleTagAdd = (tagText: string) => {
    if (!currentVideo || !user || selectedTimestamp === null || taggingPosition === null) return

    const newTag: Tag = {
      id: uuidv4(),
      videoId: currentVideo.id,
      timestamp: selectedTimestamp,
      text: tagText,
      userId: user.id,
      username: user.name,
      position: taggingPosition,
      submitted: false,
    }

    const updatedTags = [...allTags, newTag]
    setAllTags(updatedTags)
    handleCancelTag()
    toast({ title: "Tag added!", description: `Added "${tagText}" at ${newTag.timestamp.toFixed(1)}s.` })

    // Check for level up
    const userTags = updatedTags.filter(t => t.userId === user.id)
    const newLevel = Math.floor(userTags.length / TAGS_PER_LEVEL) + 1
    if (newLevel > level) {
        setLevel(newLevel);
        setShowLevelUp(true);
        setTimeout(() => setShowLevelUp(false), 3000);
    }
  }

  const handleUpdateTag = (updatedTag: Tag) => {
    setAllTags(allTags.map(tag => tag.id === updatedTag.id ? updatedTag : tag))
    toast({ title: "Tag updated!" })
  }

  const handleDeleteTag = (tagId: string) => {
    setAllTags(allTags.filter(tag => tag.id !== tagId))
    toast({ title: "Tag deleted!" })
  }

  const handleTagSelect = (tag: Tag) => {
    if (videoPlayerRef.current) {
        videoPlayerRef.current.seekTo(tag.timestamp)
    }
    setActiveTagId(tag.id)
    setSelectedTimestamp(null)
    setTaggingPosition(null)
  }
  
  const handleVideoSelect = (index: number) => {
    if (index >= 0 && index < videos.length) {
      setCurrentVideoIndex(index);
      handleCancelTag();
    }
  }

  const handleSubmitTags = async () => {
      if (!currentVideo || !user) return;
      const tagsToSubmit = userTagsForCurrentVideo.filter(tag => !tag.submitted);

      if(tagsToSubmit.length === 0) {
          toast({ title: "No new tags to submit", description: "You haven't added any new tags for this video." });
          return;
      }

      try {
          await saveTags(tagsToSubmit);
          setAllTags(allTags.map(tag => {
              const shouldUpdate = tagsToSubmit.some(t => t.id === tag.id);
              return shouldUpdate ? { ...tag, submitted: true } : tag;
          }));
          setSubmittedVideoIds(prev => new Set(prev).add(currentVideo.id));
          toast({ title: "Submission Successful!", description: `Submitted ${tagsToSubmit.length} tags for "${currentVideo.title}".` });
      } catch (error) {
          console.error("Failed to submit tags:", error);
          toast({ variant: "destructive", title: "Submission Failed", description: "Could not save tags to the database." });
      }
  };
  
  const isCurrentVideoSubmitted = submittedVideoIds.has(currentVideo?.id);


  if (authLoading || loadingData) {
    return (
      <div className="flex h-screen w-full flex-col bg-background">
        <AppHeader />
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    )
  }

  if (!user) {
    // This will be handled by the redirect in useEffect
    return null
  }
  
  if (!currentVideo) {
    return (
        <div className="flex h-screen w-full flex-col bg-background">
        <AppHeader videos={videos} allTags={allTags} submittedVideoIds={submittedVideoIds} onVideoSelect={handleVideoSelect} />
        <div className="flex flex-1 items-center justify-center text-center">
            <div>
                <h2 className="text-2xl font-semibold">No videos available</h2>
                <p className="text-muted-foreground mt-2">Please ask an administrator to upload videos for tagging.</p>
            </div>
        </div>
      </div>
    )
  }


  return (
    <div className="flex h-screen w-full flex-col bg-background">
      {showLevelUp && <LevelUpAnimation level={level} />}
      <AppHeader videos={videos} allTags={allTags} submittedVideoIds={submittedVideoIds} onVideoSelect={handleVideoSelect} />
      <main className="flex flex-1 flex-col overflow-y-auto p-4 lg:grid lg:grid-cols-3 lg:gap-6 lg:p-6">
        {/* Video Player and Navigation */}
        <div className="flex flex-col lg:col-span-2">
          <div className="relative flex-1 items-center justify-center overflow-hidden rounded-lg border bg-black text-card-foreground shadow-sm">
             <VideoPlayer
              ref={videoPlayerRef}
              videoSrc={currentVideo.srcUrl}
              onTimestampSelect={handleTimestampSelect}
              activeTag={activeTag}
              taggingPosition={taggingPosition}
              onCancelTag={handleCancelTag}
            />
          </div>
          <div className="mt-4 flex items-center justify-between">
            <Button
              onClick={() => handleVideoSelect(currentVideoIndex - 1)}
              disabled={currentVideoIndex === 0}
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Previous
            </Button>
            <div className="text-center">
                <h2 className="font-headline text-xl font-bold">{currentVideo.title}</h2>
                <p className="text-sm text-muted-foreground">Video {currentVideoIndex + 1} of {videos.length}</p>
            </div>
            <Button
              onClick={() => handleVideoSelect(currentVideoIndex + 1)}
              disabled={currentVideoIndex === videos.length - 1}
            >
              Next <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Tagging Sidebar */}
        <aside className="mt-6 flex flex-col lg:col-span-1 lg:mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Tagging Console</CardTitle>
              <CardDescription>Click the video to create a tag at the current timestamp.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <TaggingForm
                selectedTimestamp={selectedTimestamp}
                videoPlayerRef={videoPlayerRef}
                onTagAdd={handleTagAdd}
                onCancel={handleCancelTag}
              />
              <TagList
                tags={tagsForCurrentVideo}
                onUpdateTag={handleUpdateTag}
                onDeleteTag={handleDeleteTag}
                onTagSelect={handleTagSelect}
                activeTagId={activeTagId}
              />
               <div className="mt-4 border-t pt-4">
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button className="w-full" disabled={userTagsForCurrentVideo.length === 0 || isCurrentVideoSubmitted}>
                           <Send className="mr-2 h-4 w-4" />
                           {isCurrentVideoSubmitted ? "Tags Submitted" : `Submit ${userTagsForCurrentVideo.filter(t => !t.submitted).length} Tags`}
                        </Button>
                    </AlertDialogTrigger>
                    {userTagsForCurrentVideo.length > 0 && !isCurrentVideoSubmitted && (
                         <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Submit your tags?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    You are about to submit {userTagsForCurrentVideo.filter(t => !t.submitted).length} tag(s) for "{currentVideo.title}". You won't be able to edit or delete them after submission.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleSubmitTags}>
                                    Confirm & Submit
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    )}
                </AlertDialog>
                {isCurrentVideoSubmitted && (
                    <p className="text-xs text-center mt-2 text-green-600">You have already submitted your tags for this video.</p>
                )}
               </div>
            </CardContent>
          </Card>
        </aside>
      </main>
    </div>
  )
}
