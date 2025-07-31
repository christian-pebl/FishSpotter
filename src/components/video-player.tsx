"use client"

import * as React from "react"
import { Play, Pause, Rewind, FastForward, Volume2, VolumeX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { formatTimestamp } from "@/lib/utils"
import type { Tag } from "@/lib/types"

export interface VideoPlayerProps {
  videoSrc: string
  onTimestampSelect: (time: number, position: { x: number, y: number }) => void
  tags: Tag[]
  taggingPosition: { x: number, y: number } | null
  onCancelTag: () => void
  children?: React.ReactNode
}

export type VideoPlayerRef = {
  captureFrame: () => string | null
}

const VideoPlayer = React.forwardRef<VideoPlayerRef, VideoPlayerProps>(
  ({ videoSrc, onTimestampSelect, children }, ref) => {
    const videoRef = React.useRef<HTMLVideoElement>(null)
    const canvasRef = React.useRef<HTMLCanvasElement>(null)
    const containerRef = React.useRef<HTMLDivElement>(null)

    const [isPlaying, setIsPlaying] = React.useState(false)
    const [currentTime, setCurrentTime] = React.useState(0)
    const [duration, setDuration] = React.useState(0)
    const [volume, setVolume] = React.useState(1)
    const [isMuted, setIsMuted] = React.useState(false)

    React.useImperativeHandle(ref, () => ({
      captureFrame: () => {
        const video = videoRef.current
        const canvas = canvasRef.current
        if (video && canvas && video.readyState >= 2) {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          const ctx = canvas.getContext("2d")
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            return canvas.toDataURL("image/jpeg")
          }
        }
        return null
      },
    }))
    
    const handlePlayPause = () => {
      if (videoRef.current) {
        if (isPlaying) {
          videoRef.current.pause()
        } else {
          videoRef.current.play()
        }
        setIsPlaying(!isPlaying)
      }
    }
    
    const handleTimeUpdate = () => {
      if (videoRef.current) {
        setCurrentTime(videoRef.current.currentTime)
      }
    }
    
    const handleLoadedMetadata = () => {
      if (videoRef.current) {
        setDuration(videoRef.current.duration)
      }
    }

    const handleSeek = (value: number[]) => {
       if (videoRef.current) {
        videoRef.current.currentTime = value[0]
        setCurrentTime(value[0])
      }
    }
    
    const handleRewind = () => {
      if(videoRef.current) videoRef.current.currentTime -= 5;
    }

    const handleFastForward = () => {
      if(videoRef.current) videoRef.current.currentTime += 5;
    }

    const handleVolumeChange = (value: number[]) => {
      if(videoRef.current) {
        const newVolume = value[0];
        videoRef.current.volume = newVolume;
        setVolume(newVolume);
        setIsMuted(newVolume === 0);
      }
    }

    const toggleMute = () => {
       if(videoRef.current) {
        const newMuted = !isMuted;
        videoRef.current.muted = newMuted;
        setIsMuted(newMuted);
        if(!newMuted && volume === 0) {
          setVolume(0.5);
          videoRef.current.volume = 0.5;
        } else if (newMuted) {
          setVolume(0)
        }
      }
    }

    const handleVideoClick = (e: React.MouseEvent<HTMLVideoElement>) => {
      const video = videoRef.current;
      if (!video) return;

      if (!video.paused) {
        video.pause();
      }

      const rect = video.getBoundingClientRect();

      // Calculate the scale of the video within its container
      const videoRatio = video.videoWidth / video.videoHeight;
      const elementRatio = rect.width / rect.height;
      
      let scale = 1;
      let offsetX = 0;
      let offsetY = 0;

      if (videoRatio > elementRatio) { // Letterboxed (top/bottom bars)
        scale = rect.width / video.videoWidth;
        const scaledHeight = video.videoHeight * scale;
        offsetY = (rect.height - scaledHeight) / 2;
      } else { // Pillarboxed (left/right bars)
        scale = rect.height / video.videoHeight;
        const scaledWidth = video.videoWidth * scale;
        offsetX = (rect.width - scaledWidth) / 2;
      }

      // Get click coordinates relative to the video element
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Check if click is inside the visible video area
      if (clickX >= offsetX && clickX <= rect.width - offsetX &&
          clickY >= offsetY && clickY <= rect.height - offsetY) {
        
        // Calculate percentage position on the visible video
        const videoX = clickX - offsetX;
        const videoY = clickY - offsetY;
        const videoWidth = rect.width - 2 * offsetX;
        const videoHeight = rect.height - 2 * offsetY;
        
        const xPercent = (videoX / videoWidth) * 100;
        const yPercent = (videoY / videoHeight) * 100;
        
        onTimestampSelect(video.currentTime, { x: xPercent, y: yPercent });
      }
    }

    React.useEffect(() => {
      const video = videoRef.current;
      if (video) {
        video.addEventListener("timeupdate", handleTimeUpdate)
        video.addEventListener("loadedmetadata", handleLoadedMetadata)
        video.addEventListener("play", () => setIsPlaying(true));
        video.addEventListener("pause", () => setIsPlaying(false));
      }
      return () => {
        if (video) {
          video.removeEventListener("timeupdate", handleTimeUpdate)
          video.removeEventListener("loadedmetadata", handleLoadedMetadata)
          video.removeEventListener("play", () => setIsPlaying(true));
          video.removeEventListener("pause", () => setIsPlaying(false));
        }
      }
    }, [])

    return (
      <div ref={containerRef} className="relative flex h-full w-full flex-col items-center justify-center bg-black">
        <video
          ref={videoRef}
          src={videoSrc}
          className="max-h-full w-full object-contain"
          onClick={handleVideoClick}
          onDoubleClick={(e) => { e.preventDefault(); handlePlayPause(); }}
        />
        <canvas ref={canvasRef} className="hidden" />

        {children}

        <div className="absolute bottom-0 left-0 right-0 flex flex-col gap-2 bg-gradient-to-t from-black/70 to-transparent p-4 text-white transition-opacity duration-300">
           <div className="flex w-full items-center gap-2">
            <span className="font-code text-sm">{formatTimestamp(currentTime)}</span>
            <Slider
              value={[currentTime]}
              max={duration}
              step={0.1}
              onValueChange={handleSeek}
              className="w-full"
            />
            <span className="font-code text-sm">{formatTimestamp(duration)}</span>
           </div>
          <div className="flex items-center justify-center gap-2">
            <Button variant="ghost" size="icon" onClick={handleRewind} className="text-white hover:bg-white/20 hover:text-white">
              <Rewind className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handlePlayPause} className="h-12 w-12 text-white hover:bg-white/20 hover:text-white">
              {isPlaying ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={handleFastForward} className="text-white hover:bg-white/20 hover:text-white">
              <FastForward className="h-5 w-5" />
            </Button>
            <div className="flex w-24 items-center gap-2">
              <Button variant="ghost" size="icon" onClick={toggleMute} className="text-white hover:bg-white/20 hover:text-white">
                {isMuted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </Button>
              <Slider
                value={[isMuted ? 0 : volume]}
                max={1}
                step={0.05}
                onValueChange={handleVolumeChange}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }
)

VideoPlayer.displayName = "VideoPlayer"
export default VideoPlayer
