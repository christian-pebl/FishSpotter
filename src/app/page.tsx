
"use client"

import * as React from "react"
import { ArrowLeft, ArrowRight, Upload, Sparkles, Award, CheckCircle2, PartyPopper, Loader2 } from "lucide-react"

import { getVideos, getTags, saveTags as saveTagsAction } from "@/lib/actions"
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
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [videos, setVideos] = React.useState<Video[]>([])
  const [allTags, setAllTags] = React.useState<Tag[]>([])
  const [dataLoading, setDataLoading] = React.useState(true);
  const [currentVideoIndex, setCurrentVideoIndex] = React.useState(0)
  const [selectedTimestamp, setSelectedTimestamp] = React.useState<number | null>(null)
  const [taggingPosition, setTaggingPosition] = React.useState<{ x: number; y: number } | null>(null)
  const [lastAddedTag, setLastAddedTag] = React.useState<Tag | null>(null);
  const [activeTag, setActiveTag] = React.useState<Tag | null>(null);

  // Gamification state
  const [score, setScore] = React.useState(0);
  const [level, setLevel] = React.useState(1);
  const [showLevelUp, setShowLevelUp] = React.useState(false);
  const [submittedVideoIds, setSubmittedVideoIds] = React.useState<Set<string>>(new Set());

  const videoPlayerRef = React.useRef<VideoPlayerRef>(null)
  const { toast } = useToast();

  React.useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  React.useEffect(() => {
    async function fetchData() {
      if (user) {
        setDataLoading(true);
        try {
          const [fetchedVideos, fetchedTags] = await Promise.all([
            getVideos(),
            getTags()
          ]);
          setVideos(fetchedVideos);
          setAllTags(fetchedTags);

          // Logic to determine which videos are already submitted by the user
          const userTags = fetchedTags.filter(t => t.userId === user.id && t.submitted);
          const submittedIds = new Set(userTags.map(t => t.videoId));
          setSubmittedVideoIds(submittedIds);

        } catch (error) {
          console.error("Failed to fetch data:", error);
          toast({
            variant: "destructive",
            title: "Error fetching data",
            description: "Could not load videos and tags.",
          });
        } finally {
          setDataLoading(false);
        }
      }
    }
    if (!authLoading && user) {
        fetchData();
    }
  }, [user, authLoading, toast]);


  const currentVideo = videos[currentVideoIndex]
  const currentVideoTags = allTags.filter(tag => tag.videoId === currentVideo?.id)
  const isVideoSubmitted = submittedVideoIds.has(currentVideo?.id);
  const allVideosSubmitted = videos.length > 0 && submittedVideoIds.size === videos.length;


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
    setActiveTag(null);
  }

  const resetSelection = () => {
    setSelectedTimestamp(null)
    setTaggingPosition(null)
    setActiveTag(null);
  }

  const handleNextVideo = () => {
    resetSelection()
    setCurrentVideoIndex((prevIndex) => (prevIndex + 1) % videos.length)
  }

  const handlePrevVideo = () => {
    resetSelection()
    setCurrentVideoIndex((prevIndex) => (prevIndex - 1 + videos.length) % videos.length)
  }
  
  const handleVideoSelect = (index: number) => {
    resetSelection()
    setCurrentVideoIndex(index);
  }

  const handleAddTag = (newTagText: string) => {
    if (selectedTimestamp === null || taggingPosition === null || !user || !currentVideo) return;
    const newTag: Tag = {
      id: `tag-${Date.now()}`,
      videoId: currentVideo.id,
      timestamp: selectedTimestamp,
      text: newTagText,
      userId: user.id,
      username: user.name,
      position: taggingPosition,
      submitted: false,
    }
    setAllTags(prev => [...prev, newTag].sort((a,b) => a.timestamp - b.timestamp));
    
    setLastAddedTag(newTag);
    setTimeout(() => setLastAddedTag(null), 1000); // Animation duration

    resetSelection()
  }

  const handleUpdateTag = (updatedTag: Tag) => {
    setAllTags(prev => prev.map(t => t.id === updatedTag.id ? updatedTag : t))
    if (activeTag?.id === updatedTag.id) {
        setActiveTag(updatedTag);
    }
  }
  
  const handleDeleteTag = (tagId: string) => {
    setAllTags(prev => prev.filter(t => t.id !== tagId))
     if (activeTag?.id === tagId) {
        setActiveTag(null);
    }
  }
  
  const handleTagSelect = (tag: Tag) => {
    if (videoPlayerRef.current) {
        videoPlayerRef.current.seekTo(tag.timestamp);
    }
    resetSelection();
    setActiveTag(tag);
  }

  const handleSubmitTags = async () => {
    if (isVideoSubmitted || !currentVideo || !user) return;

    try {
        const userTagsForVideo = currentVideoTags.filter(t => t.userId === user.id && !t.submitted);
        await saveTagsAction(userTagsForVideo);
        
        // Mark tags as submitted locally
        setAllTags(prevTags => prevTags.map(tag => 
            userTagsForVideo.some(submittedTag => submittedTag.id === tag.id) 
            ? { ...tag, submitted: true } 
            : tag
        ));

        const pointsEarned = Math.round(currentVideo.duration);
        const newScore = score + pointsEarned;
        setScore(newScore);
        setSubmittedVideoIds(new Set(submittedVideoIds).add(currentVideo.id));
        handleLevelUpCheck(newScore);
        toast({
        title: "Submission Successful!",
        description: `You earned ${pointsEarned} points for submitting your tags.`,
        });

    } catch (error) {
        console.error("Error submitting tags: ", error);
        toast({
            variant: "destructive",
            title: "Submission Failed",
            description: "Could not save your tags. Please try again.",
        });
    }
  }

  const progressToNextLevel = (score % LEVEL_UP_THRESHOLD) / LEVEL_UP_THRESHOLD * 100;
  
  if (authLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col bg-background text-foreground">
      {showLevelUp && <LevelUpAnimation level={level} />}
      <AppHeader 
        videos={videos}
        allTags={allTags}
        submittedVideoIds={submittedVideoIds}
        onVideoSelect={handleVideoSelect}
      />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        { dataLoading ? (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="ml-2">Loading videos...</p>
            </div>
        ) : allVideosSubmitted ? (
            <div className="mx-auto flex h-full max-w-4xl items-center justify-center">
                <Card className="w-full text-center">
                    <CardHeader>
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                           <PartyPopper className="h-10 w-10 text-green-600" />
                        </div>
                        <CardTitle className="mt-4 font-headline text-3xl">Congratulations!</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 pb-8">
                        <p className="text-lg text-muted-foreground">You have tagged and submitted all available videos.</p>
                        <p>Thank you for your valuable contribution to marine life research. You're a true Fish Spotter!</p>
                    </CardContent>
                </Card>
            </div>
        ) : (
            currentVideo ? (
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
                                activeTag={activeTag}
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
                        </CardHeader>
                        <CardContent>
                            <div className="mb-4 flex items-center justify-end gap-4 rounded-md border p-2">
                                <div className="flex items-center gap-2 text-yellow-500">
                                    <Award className="h-5 w-5" />
                                    <span className="font-bold">Level {level}</span>
                                </div>
                                <div className="w-32">
                                    <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>Score</span>
                                    <span>{score % LEVEL_UP_THRESHOLD}/{LEVEL_UP_THRESHOLD}</span>
                                    </div>
                                    <Progress value={progressToNextLevel} className="h-1.5" />
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
                                onTagSelect={handleTagSelect}
                                activeTagId={activeTag?.id ?? null}
                            />
                            )}
                        </CardContent>
                        </Card>
                    </div>
                </div>
            ) : (
                 <div className="flex h-full flex-col items-center justify-center gap-4">
                    <p className="text-lg text-muted-foreground">No videos available for tagging.</p>
                </div>
            )
        )}
      </main>
    </div>
  )
}

    