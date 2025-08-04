
"use client"

import * as React from "react"
import { Play, Pause, Rewind, FastForward, Volume2, VolumeX, Maximize } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { formatTimestamp, cn } from "@/lib/utils"
import type { Tag } from "@/lib/types"

export interface VideoPlayerProps {
  videoSrc: string
  onTimestampSelect: (time: number, position: { x: number, y: number }) => void
  activeTag: Tag | null
  taggingPosition: { x: number, y: number } | null
  onCancelTag: () => void
  children?: React.ReactNode
}

export type VideoPlayerRef = {
  captureFrame: () => string | null
  seekTo: (time: number) => void
}

const TagPin = ({ position, isNew = false, isActive = false }: { position: { x: number; y: number }, isNew?: boolean, isActive?: boolean }) => {
    const colorClass = isNew ? 'bg-yellow-300' : 'bg-white/90'
    const lineCommon = cn('absolute', colorClass);

    return (
        <div
            className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
            style={{
                left: `${position.x}%`,
                top: `${position.y}%`,
                pointerEvents: 'none',
            }}
        >
            <div className="relative h-6 w-6">
                 {/* Crosshair lines with gap */}
                <div className={cn(lineCommon, "left-1/2 -translate-x-1/2 top-0 h-[calc(50%-4px)] w-px")} />
                <div className={cn(lineCommon, "left-1/2 -translate-x-1/2 bottom-0 h-[calc(50%-4px)] w-px")} />
                <div className={cn(lineCommon, "top-1/2 -translate-y-1/2 left-0 w-[calc(50%-4px)] h-px")} />
                <div className={cn(lineCommon, "top-1/2 -translate-y-1/2 right-0 w-[calc(50%-4px)] h-px")} />
            </div>
        </div>
    );
};


const VideoPlayer = React.forwardRef<VideoPlayerRef, VideoPlayerProps>(
  ({ videoSrc, onTimestampSelect, activeTag, taggingPosition, onCancelTag }, ref) => {
    const videoRef = React.useRef<HTMLVideoElement>(null)
    const canvasRef = React.useRef<HTMLCanvasElement>(null)
    const containerRef = React.useRef<HTMLDivElement>(null);
    
    const [isPlaying, setIsPlaying] = React.useState(false)
    const [duration, setDuration] = React.useState(0)
    const [currentTime, setCurrentTime] = React.useState(0)
    const [volume, setVolume] = React.useState(1)
    const [isMuted, setIsMuted] = React.useState(false)
    const [isHovering, setIsHovering] = React.useState(false);

    React.useEffect(() => {
        const video = videoRef.current
        if (!video) return

        const setVideoData = () => {
            setDuration(video.duration)
            setCurrentTime(video.currentTime)
        }
        const setVideoTime = () => setCurrentTime(video.currentTime)
        
        video.addEventListener("loadeddata", setVideoData)
        video.addEventListener("timeupdate", setVideoTime)

        return () => {
            video.removeEventListener("loadeddata", setVideoData)
            video.removeEventListener("timeupdate", setVideoTime)
        }
    }, [])

    React.useImperativeHandle(ref, () => ({
      captureFrame: () => {
        const video = videoRef.current
        const canvas = canvasRef.current
        if (video && canvas) {
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
      seekTo: (time: number) => {
        if (videoRef.current) {
          videoRef.current.currentTime = time
          if (!isPlaying) {
            videoRef.current.play();
            setTimeout(() => videoRef.current?.pause(), 100);
          }
        }
      }
    }))
    
    const handleVideoClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (taggingPosition) {
        onCancelTag()
        return;
      }
      if (activeTag) {
        onCancelTag()
        return;
      }

      const rect = e.currentTarget.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      
      const video = videoRef.current
      if (video) {
        if (isPlaying) video.pause();
        onTimestampSelect(video.currentTime, { x, y });
      }
    }

    const togglePlay = () => {
      const video = videoRef.current
      if (video) {
        if (video.paused) {
          video.play()
          setIsPlaying(true)
        } else {
          video.pause()
          setIsPlaying(false)
        }
      }
    }

    const handleSeek = (value: number[]) => {
      const video = videoRef.current
      if (video) {
        video.currentTime = value[0]
        setCurrentTime(value[0])
      }
    }

    const handleVolumeChange = (value: number[]) => {
        const newVolume = value[0];
        setVolume(newVolume);
        setIsMuted(newVolume === 0);
        if (videoRef.current) {
            videoRef.current.volume = newVolume;
            videoRef.current.muted = newVolume === 0;
        }
    }

    const toggleMute = () => {
        if (videoRef.current) {
            videoRef.current.muted = !isMuted;
            setIsMuted(!isMuted);
            if (!isMuted) setVolume(0); else setVolume(videoRef.current.volume || 1);
        }
    }

    const handleFullscreen = () => {
      if (containerRef.current) {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          containerRef.current.requestFullscreen();
        }
      }
    }

    return (
      <div 
        ref={containerRef}
        className="group relative w-full h-full"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        onClick={handleVideoClick}
      >
        <video ref={videoRef} src={videoSrc} className="h-full w-full object-contain" muted={isMuted} />
        <canvas ref={canvasRef} className="hidden" />

        {taggingPosition && <TagPin position={taggingPosition} isNew />}
        {activeTag && <TagPin position={activeTag.position} isActive />}
        
        <div 
          className={cn(
            "absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/60 to-transparent p-4 transition-opacity duration-300",
            (isHovering || !isPlaying) ? 'opacity-100' : 'opacity-0'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col gap-2">
            <Slider
                value={[currentTime]}
                max={duration}
                step={0.1}
                onValueChange={handleSeek}
                className="w-full cursor-pointer"
            />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={togglePlay}>
                  {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                </Button>
                 <div className="flex items-center gap-2 w-32">
                  <Button variant="ghost" size="icon" onClick={toggleMute} className="h-8 w-8">
                      {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </Button>
                  <Slider defaultValue={[1]} max={1} step={0.1} value={[isMuted ? 0 : volume]} onValueChange={handleVolumeChange} className="cursor-pointer" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-code text-sm text-white">{formatTimestamp(currentTime)} / {formatTimestamp(duration)}</span>
                <Button variant="ghost" size="icon" onClick={handleFullscreen}>
                  <Maximize className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>

      </div>
    )
  }
)

VideoPlayer.displayName = "VideoPlayer"

export default VideoPlayer
