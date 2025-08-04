"use client"

import * as React from "react"
import { ArrowLeft, ArrowRight, Loader2, Upload, Sparkles, Award } from "lucide-react"

import { MOCK_VIDEOS, MOCK_TAGS } from "@/lib/data"
import type { Video, Tag } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import AppHeader from "@/components/app-header"
import VideoPlayer, { type VideoPlayerRef } from "@/components/video-player"
import TaggingForm from "@/components/tagging-form"
import TagList from "@/components/tag-list"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"


const LEVEL_UP_THRESHOLD = 100; // Points needed to level up

export default function TaggerPage() {
  const [videos, setVideos] = React.useState<Video[]>(MOCK_VIDEOS)
  const [allTags, setAllTags] = React.useState<Tag[]>(MOCK_TAGS)
  const [currentVideoIndex, setCurrentVideoIndex] = React.useState(0)
  const [selectedTimestamp, setSelectedTimestamp] = React.useState<number | null>(null)
  const [taggingPosition, setTaggingPosition] = React.useState<{ x: number; y: number } | null>(null)
  const [lastAddedTag, setLastAddedTag] = React.useState<Tag | null>(null);

  // Gamification state
  const [score, setScore] = React.useState(0);
  const [level, setLevel] = React.useState(1);

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
    setAllTags(prev => [...prev, newTag].sort((a,b) => a.timestamp - b.timestamp));
    
    // Gamification logic
    const newScore = score + 15;
    setScore(newScore);
    if (newScore >= level * LEVEL_UP_THRESHOLD) {
      setLevel(level + 1);
    }
    
    setLastAddedTag(newTag);
    setTimeout(() => setLastAddedTag(null), 1000); // Animation duration

    resetSelection()
  }

  const handleUpdateTag = (updatedTag: Tag) => {
    setAllTags(prev => prev.map(t => t.id === updatedTag.id ? updatedTag : t))
  }
  
  const handleDeleteTag = (tagId: string) => {
    setAllTags(prev => prev.filter(t => t.id !== tagId))
  }

  const progressToNextLevel = (score % LEVEL_UP_THRESHOLD) / LEVEL_UP_THRESHOLD * 100;

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
            <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-lg border bg-black text-card-foreground shadow-sm" style={{aspectRatio: '16 / 9'}}>
                <VideoPlayer
                  ref={videoPlayerRef}
                  videoSrc={currentVideo.srcUrl}
                  onTimestampSelect={handleTimestampSelect}
                  tags={currentVideoTags}
                  onCancelTag={resetSelection}
                  taggingPosition={taggingPosition}
                />
                {lastAddedTag && (
                  <div
                    className="absolute z-20 -translate-x-1/2 -translate-y-1/2 animate-ping"
                    style={{ left: `${lastAddedTag.position.x}%`, top: `${lastAddedTag.position.y}%` }}
                  >
                    <Sparkles className="h-8 w-8 text-yellow-400" />
                  </div>
                )}
            </div>
          </div>
          <div className="flex h-full flex-col">
            <Card className="flex-1">
              <CardHeader>
                <CardTitle className="font-headline">Annotation Tools</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4 rounded-lg border p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="font-semibold text-lg">User Stats</h4>
                    <div className="flex items-center gap-2 text-yellow-500">
                      <Award className="h-5 w-5" />
                      <span className="font-bold">Level {level}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Score</span>
                      <span>{score} / {level * LEVEL_UP_THRESHOLD}</span>
                    </div>
                    <Progress value={progressToNextLevel} className="h-2" />
                  </div>
                </div>
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
