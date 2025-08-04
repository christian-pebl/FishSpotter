
"use client"

import * as React from "react"
import { ArrowLeft, ArrowRight, Upload, Sparkles, Award, CheckCircle2 } from "lucide-react"

import { MOCK_VIDEOS, MOCK_TAGS } from "@/lib/data"
import type { Video, Tag } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import AppHeader from "@/components/app-header"
import VideoPlayer, { type VideoPlayerRef } from "@/components/video-player"
import TaggingForm from "@/components/tagging-form"
import TagList from "@/components/tag-list"
import { Progress } from "@/components/ui/progress"
import LevelUpAnimation from "@/components/level-up-animation"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/context/AuthContext"
import { useRouter } from "next/navigation"


const LEVEL_UP_THRESHOLD = 100;

export default function TaggerPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);


  const [videos, setVideos] = React.useState<Video[]>(MOCK_VIDEOS)
  const [allTags, setAllTags] = React.useState<Tag[]>(MOCK_TAGS)
  const [currentVideoIndex, setCurrentVideoIndex] = React.useState(0)
  const [selectedTimestamp, setSelectedTimestamp] = React.useState<number | null>(null)
  const [taggingPosition, setTaggingPosition] = React.useState<{ x: number; y: number } | null>(null)
  const [lastAddedTag, setLastAddedTag] = React.useState<Tag | null>(null);

  // Gamification state
  const [score, setScore] = React.useState(0);
  const [level, setLevel] = React.useState(1);
  const [showLevelUp, setShowLevelUp] = React.useState(false);
  const [submittedVideoIds, setSubmittedVideoIds] = React.useState<Set<string>>(new Set());

  const videoPlayerRef = React.useRef<VideoPlayerRef>(null)
  const { toast } = useToast();

  const currentVideo = videos[currentVideoIndex]
  const currentVideoTags = allTags.filter(tag => tag.videoId === currentVideo.id)
  const isVideoSubmitted = submittedVideoIds.has(currentVideo.id);

  const handleLevelUpCheck = (newScore: number) => {
    const oldLevel = level;
    const newLevel = Math.floor(newScore / LEVEL_UP_THRESHOLD) + 1;
    if (newLevel > oldLevel) {
      setLevel(newLevel);
      setShowLevelUp(true);
      setTimeout(() => setShowLevelUp(false), 3000); // Show level up animation for 3 seconds
    }
  };

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
    if (selectedTimestamp === null || taggingPosition === null || !user) return;
    const newTag: Tag = {
      id: `tag-${Date.now()}`,
      videoId: currentVideo.id,
      timestamp: selectedTimestamp,
      text: newTagText,
      userId: user.id,
      username: user.name,
      position: taggingPosition
    }
    setAllTags(prev => [...prev, newTag].sort((a,b) => a.timestamp - b.timestamp));
    
    // Gamification logic
    const newScore = score + 15;
    setScore(newScore);
    handleLevelUpCheck(newScore);
    
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

  const handleSubmitTags = () => {
    if (isVideoSubmitted) return;

    const pointsEarned = 50;
    const newScore = score + pointsEarned;
    setScore(newScore);
    setSubmittedVideoIds(new Set(submittedVideoIds).add(currentVideo.id));
    handleLevelUpCheck(newScore);
    toast({
      title: "Submission Successful!",
      description: `You earned ${pointsEarned} points for submitting your tags.`,
    });
  }

  const progressToNextLevel = (score % LEVEL_UP_THRESHOLD) / LEVEL_UP_THRESHOLD * 100;

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!currentVideo) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p>No videos available.</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col bg-background text-foreground">
      {showLevelUp && <LevelUpAnimation level={level} />}
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
                <span className="text-sm font-medium text-muted-foreground">
                  {currentVideoIndex + 1} / {videos.length}
                </span>
                <Button variant="outline" size="icon" onClick={handleNextVideo} aria-label="Next Video">
                  <ArrowRight className="h-4 w-4" />
                </Button>
                {user.role === 'admin' && (
                  <Button variant="outline">
                    <Upload className="mr-2 h-4 w-4" />
                    Admin Upload
                  </Button>
                )}
                <Button onClick={handleSubmitTags} disabled={isVideoSubmitted}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {isVideoSubmitted ? "Submitted" : "Submit Tags"}
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
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="font-headline">Annotation Tools</CardTitle>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-yellow-500">
                    <Award className="h-5 w-5" />
                    <span className="font-bold">Level {level}</span>
                  </div>
                  <div className="w-24">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Score</span>
                      <span>{score % LEVEL_UP_THRESHOLD}/{LEVEL_UP_THRESHOLD}</span>
                    </div>
                    <Progress value={progressToNextLevel} className="h-1.5" />
                  </div>
                </div>
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
