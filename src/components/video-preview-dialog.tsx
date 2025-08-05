
"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import VideoPlayer from "@/components/video-player"
import type { Video } from "@/lib/types"

interface VideoPreviewDialogProps {
  video: Video | null
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
}

export default function VideoPreviewDialog({ video, isOpen, onOpenChange }: VideoPreviewDialogProps) {
  
  const noOp = () => {};

  if (!video) return null

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{video.title}</DialogTitle>
        </DialogHeader>
        <div className="mt-4">
            <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-lg border bg-black text-card-foreground shadow-sm" style={{aspectRatio: '16 / 9'}}>
                <VideoPlayer
                    videoSrc={video.srcUrl}
                    onTimestampSelect={noOp}
                    activeTag={null}
                    taggingPosition={null}
                    onCancelTag={noOp}
                />
            </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
