"use client"

import * as React from "react"
import { ArrowLeft, ArrowRight, Loader2, Upload, Trash } from "lucide-react"

import { MOCK_VIDEOS, MOCK_TAGS } from "@/lib/data"
import type { Video, Tag } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import AppHeader from "@/components/app-header"
import VideoPlayer, { type VideoPlayerRef } from "@/components/video-player"
import TaggingForm from "@/components/tagging-form"
import TagList from "@/components/tag-list"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"

export default function TaggerPage() {
  const [videos, setVideos] = React.useState<Video[]>(MOCK_VIDEOS)
  const [allTags, setAllTags] = React.useState<Tag[]>(MOCK_TAGS)
  const [currentVideoIndex, setCurrentVideoIndex] = React.useState(0)
  const [selectedTimestamp, setSelectedTimestamp] = React.useState<number | null>(null)
  const [taggingPosition, setTaggingPosition] = React.useState<{ x: number; y: number } | null>(null)
  
  const videoPlayerRef = React.useRef<VideoPlayerRef>(null)

  const currentVideo = videos[currentVideoIndex]
  const currentVideoTags = allTags.filter(tag => tag.videoId === currentVideo.id)

  const handleTimestampSelect = (time: number, position: { x: number, y: number }) => {
    setSelectedTimestamp(time)
    setTaggingPosition(position)
  }

  const resetSelection = () => {
    setSelectedTimestamp(null)
    setTaggingPosition(null)
  }

  const handleNextVideo = () => {
    resetSelection()
    setCurrentVideoIndex((prevIndex) => (prevIndex + 1) % videos.length)
  }

  const handlePrevVideo = () => {
    resetSelection()
    setCurrentVideoIndex((prevIndex) => (prevIndex - 1 + videos.length) % videos.length)
  }
  
  const handleAddTag = (newTagText: string) => {
    if (selectedTimestamp === null || taggingPosition === null) return;
    const newTag: Tag = {
      id: `tag-${Date.now()}`,
      videoId: currentVideo.id,
      timestamp: selectedTimestamp,
      text: newTagText,
      userId: 'user-1',
      username: 'MarineExplorer',
      position: taggingPosition
    }
    setAllTags(prev => [...prev, newTag].sort((a,b) => a.timestamp - b.timestamp))
    resetSelection()
  }

  const handleUpdateTag = (updatedTag: Tag) => {
    setAllTags(prev => prev.map(t => t.id === updatedTag.id ? updatedTag : t))
  }
  
  const handleDeleteTag = (tagId: string) => {
    setAllTags(prev => prev.filter(t => t.id !== tagId))
  }
  
  const handleClearAllTags = () => {
    setAllTags(prev => prev.filter(t => t.videoId !== currentVideo.id))
  }

  if (!currentVideo) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex h-screen w-full flex-col bg-background text-foreground">
      <AppHeader />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="mx-auto grid h-full max-w-7xl grid-cols-1 gap-6 md:grid-cols-3">
          <div className="flex h-full flex-col gap-4 md:col-span-2">
            <div className="flex items-center justify-between">
              <h1 className="font-headline text-2xl font-bold">{currentVideo.title}</h1>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={handlePrevVideo} aria-label="Previous Video">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={handleNextVideo} aria-label="Next Video">
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button variant="secondary">
                  <Upload className="mr-2 h-4 w-4" />
                  Admin Upload
                </Button>
              </div>
            </div>
            <div className="flex flex-1 items-center justify-center overflow-hidden rounded-lg border bg-black text-card-foreground shadow-sm" style={{aspectRatio: '16 / 9'}}>
                <VideoPlayer
                  ref={videoPlayerRef}
                  videoSrc={currentVideo.srcUrl}
                  onTimestampSelect={handleTimestampSelect}
                  tags={currentVideoTags}
                  onCancelTag={resetSelection}
                  taggingPosition={taggingPosition}
                />
            </div>
          </div>
          <div className="flex h-full flex-col">
            <Card className="flex-1">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="font-headline">Annotation Tools</CardTitle>
                 {currentVideoTags.length > 0 && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          <Trash className="mr-2 h-4 w-4" />
                          Clear All
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete all {currentVideoTags.length} tags from this video. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleClearAllTags} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete All
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
              </CardHeader>
              <CardContent>
                {selectedTimestamp !== null && taggingPosition !== null ? (
                  <TaggingForm 
                    selectedTimestamp={selectedTimestamp}
                    videoPlayerRef={videoPlayerRef}
                    onTagAdd={handleAddTag}
                    onCancel={resetSelection}
                  />
                ) : (
                  <TagList
                    tags={currentVideoTags}
                    onUpdateTag={handleUpdateTag}
                    onDeleteTag={handleDeleteTag}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
