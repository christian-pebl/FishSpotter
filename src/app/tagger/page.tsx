
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { getVideos, getTags, saveTags } from "@/lib/actions"
import type { Video, Tag } from "@/lib/types"

import AppHeader from "@/components/app-header"
import VideoPlayer, { type VideoPlayerRef } from "@/components/video-player"
import TagList from "@/components/tag-list"
import TaggingForm from "@/components/tagging-form"
import LevelUpAnimation from "@/components/level-up-animation"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Loader2, ArrowLeft, ArrowRight, Check, Send } from "lucide-react"

export default function TaggerPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  
  const [videos, setVideos] = React.useState<Video[]>([])
  const [tags, setTags] = React.useState<Tag[]>([])
  const [currentVideoIndex, setCurrentVideoIndex] = React.useState(0)
  const [loading, setLoading] = React.useState(true)

  const [selectedTimestamp, setSelectedTimestamp] = React.useState<number | null>(null)
  const [taggingPosition, setTaggingPosition] = React.useState<{x: number, y: number} | null>(null)
  const [activeTagId, setActiveTagId] = React.useState<string | null>(null)

  const videoPlayerRef = React.useRef<VideoPlayerRef>(null)
  
  const [level, setLevel] = React.useState(1)
  const [showLevelUp, setShowLevelUp] = React.useState(false)

  React.useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [user, authLoading, router])

  React.useEffect(() => {
    async function fetchData() {
      if (user) {
        try {
          setLoading(true)
          const [fetchedVideos, fetchedTags] = await Promise.all([getVideos(), getTags()])
          setVideos(fetchedVideos)
          setTags(fetchedTags)
        } catch (error) {
          console.error("Failed to fetch data:", error)
          toast({ variant: "destructive", title: "Failed to load data" })
        } finally {
          setLoading(false)
        }
      }
    }
    fetchData()
  }, [user, toast])

  const checkLevelUp = (newTagsCount: number) => {
    const newLevel = Math.floor(newTagsCount / 5) + 1;
    if (newLevel > level) {
      setLevel(newLevel);
      setShowLevelUp(true);
      setTimeout(() => setShowLevelUp(false), 3000);
    }
  };

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
    if (selectedTimestamp !== null && taggingPosition && user) {
      const newTag: Tag = {
        id: `temp-${Date.now()}`,
        videoId: videos[currentVideoIndex].id,
        timestamp: selectedTimestamp,
        text: tagText,
        userId: user.id,
        username: user.name,
        position: taggingPosition,
        submitted: false
      }
      
      const newTags = [...tags, newTag];
      setTags(newTags);

      const userTagsCount = newTags.filter(t => t.userId === user.id).length;
      checkLevelUp(userTagsCount);

      handleCancelTag()
    }
  }

  const handleUpdateTag = (updatedTag: Tag) => {
    setTags(tags.map(tag => tag.id === updatedTag.id ? updatedTag : tag))
  }

  const handleDeleteTag = (tagId: string) => {
    setTags(tags.filter(tag => tag.id !== tagId))
  }
  
  const handleTagSelect = (tag: Tag) => {
    if (videoPlayerRef.current) {
        videoPlayerRef.current.seekTo(tag.timestamp);
    }
    setActiveTagId(tag.id);
    setSelectedTimestamp(null);
    setTaggingPosition(null);
  }

  const currentVideo = videos[currentVideoIndex]
  const currentVideoTags = tags.filter(tag => tag.videoId === currentVideo?.id)
  
  const userTagsForCurrentVideo = currentVideoTags.filter(tag => tag.userId === user?.id && !tag.submitted);
  const submittedVideoIds = new Set(tags.filter(t => t.userId === user?.id && t.submitted).map(t => t.videoId));

  const goToNextVideo = () => {
    setCurrentVideoIndex((prev) => (prev + 1) % videos.length)
    handleCancelTag()
  }

  const goToPrevVideo = () => {
    setCurrentVideoIndex((prev) => (prev - 1 + videos.length) % videos.length)
    handleCancelTag()
  }

  const handleSubmitTags = async () => {
    if (!user) return;
    try {
      await saveTags(userTagsForCurrentVideo);
      
      // Update local state to mark tags as submitted
      setTags(tags.map(tag => 
        userTagsForCurrentVideo.some(subTag => subTag.id === tag.id) 
        ? { ...tag, submitted: true } 
        : tag
      ));

      toast({
        title: "Tags Submitted!",
        description: `Your ${userTagsForCurrentVideo.length} tags for "${currentVideo.title}" have been saved.`,
      })
    } catch (error) {
       toast({
        variant: "destructive",
        title: "Submission Failed",
        description: "Could not save your tags. Please try again.",
      })
    }
  }


  if (authLoading || loading) {
    return (
      <div className="flex h-screen w-full flex-col bg-background">
        <AppHeader />
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="ml-2">Loading Tagger...</p>
        </div>
      </div>
    )
  }
  
  if (!user) {
     return null; // Redirecting
  }

  if (videos.length === 0) {
    return (
      <div className="flex h-screen w-full flex-col bg-background">
        <AppHeader />
        <div className="flex flex-1 items-center justify-center">
            <p>No videos available for tagging. An admin needs to upload some.</p>
        </div>
      </div>
    )
  }

  const activeTag = tags.find(t => t.id === activeTagId) || null;

  return (
    <div className="flex h-screen w-full flex-col bg-background">
      {showLevelUp && <LevelUpAnimation level={level} />}
      <AppHeader 
        videos={videos}
        allTags={tags}
        submittedVideoIds={submittedVideoIds}
        onVideoSelect={setCurrentVideoIndex}
      />

      <main className="grid flex-1 grid-cols-1 md:grid-cols-3 md:gap-4 lg:grid-cols-4 lg:gap-6 p-4">
        <div className="md:col-span-2 lg:col-span-3 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-headline text-2xl font-bold">{currentVideo.title}</h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={goToPrevVideo}>
                <ArrowLeft />
              </Button>
              <span className="text-sm text-muted-foreground">{currentVideoIndex + 1} / {videos.length}</span>
              <Button variant="outline" size="icon" onClick={goToNextVideo}>
                <ArrowRight />
              </Button>
            </div>
          </div>
          
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
        </div>

        <div className="md:col-span-1 lg:col-span-1 flex flex-col gap-4 mt-4 md:mt-0">
            <div className="flex items-center justify-between">
                <h3 className="font-headline text-xl font-bold">Tags</h3>
                {submittedVideoIds.has(currentVideo.id) ? (
                    <div className="flex items-center gap-2 text-green-600">
                        <Check className="h-5 w-5" />
                        <span className="font-semibold">Submitted</span>
                    </div>
                ) : (
                    <Button 
                      onClick={handleSubmitTags}
                      disabled={userTagsForCurrentVideo.length === 0}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Submit {userTagsForCurrentVideo.length} Tags
                    </Button>
                )}
            </div>

            <div className="flex-1">
                {selectedTimestamp !== null ? (
                    <TaggingForm 
                        selectedTimestamp={selectedTimestamp}
                        videoPlayerRef={videoPlayerRef}
                        onTagAdd={handleTagAdd}
                        onCancel={handleCancelTag}
                    />
                ) : (
                    <TagList 
                        tags={currentVideoTags} 
                        onUpdateTag={handleUpdateTag} 
                        onDeleteTag={handleDeleteTag}
                        onTagSelect={handleTagSelect}
                        activeTagId={activeTagId}
                    />
                )}
            </div>
        </div>
      </main>
    </div>
  )
}
