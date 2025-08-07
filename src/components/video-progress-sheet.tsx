
"use client"

import * as React from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CheckCircle2, ListVideo, TagIcon } from "lucide-react"
import type { Video, Tag } from "@/lib/types"
import { useSupabaseAuth } from "@/context/SupabaseAuthContext"

interface VideoProgressSheetProps {
  videos: Video[];
  allTags: Tag[];
  submittedVideoIds: Set<string>;
  onVideoSelect: (index: number) => void;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  currentUser: NonNullable<ReturnType<typeof useAuth>['user']>;
}

export default function VideoProgressSheet({ videos, allTags, submittedVideoIds, onVideoSelect, isOpen, onOpenChange, currentUser }: VideoProgressSheetProps) {
  
  const handleVideoClick = (index: number) => {
    onVideoSelect(index);
    onOpenChange(false);
  }
  
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button variant="outline">
          <ListVideo className="mr-2 h-4 w-4" />
          My Progress
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Your Progress</SheetTitle>
          <SheetDescription>
            Track your tagging progress across all videos. Click a video to jump to it.
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-8rem)] pr-4 mt-4">
          <div className="space-y-4">
            {videos.map((video, index) => {
              const userTagsForVideo = allTags.filter(tag => tag.videoId === video.id && tag.userId === currentUser.id);
              const isSubmitted = submittedVideoIds.has(video.id);

              return (
                <div
                  key={video.id}
                  onClick={() => handleVideoClick(index)}
                  className="flex cursor-pointer items-center gap-4 rounded-lg border p-3 transition-colors hover:bg-muted"
                >
                  <Image
                    src={video.thumbnailUrl}
                    alt={video.title}
                    width={120}
                    height={68}
                    className="rounded-md object-cover"
                  />
                  <div className="flex-1">
                    <p className="font-semibold">{video.title}</p>
                    <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <TagIcon className="h-4 w-4" />
                        <span>{userTagsForVideo.length} {userTagsForVideo.length === 1 ? 'tag' : 'tags'}</span>
                      </div>
                      {isSubmitted && (
                        <div className="flex items-center gap-1 text-green-500">
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Submitted</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
