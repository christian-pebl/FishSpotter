
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

const TagPin = ({ position, isHover = false }: { position: { x: number; y: number }, isHover?: boolean }) => (
  <div
    className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
    style={{
      left: `${position.x}%`,
      top: `${position.y}%`,
      pointerEvents: 'none',
    }}
  >
    <div className={`relative h-4 w-4 ${isHover ? 'opacity-50' : ''}`}>
      <div className="absolute left-1/2 top-0 h-1/2 w-px -translate-x-1/2 bg-red-500" />
      <div className="absolute left-1/2 bottom-0 h-1/2 w-px -translate-x-1/2 bg-red-500" />
      <div className="absolute top-1/2 left-0 h-px w-1/2 -translate-y-1/2 bg-red-500" />
      <div className="absolute top-1/2 right-0 h-px w-1/2 -translate-y-1/2 bg-red-500" />
      <div className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500" />
    </div>
  </div>
);


const VideoPlayer = React.forwardRef<VideoPlayerRef, VideoPlayerProps>(
  ({ videoSrc, onTimestampSelect, tags, taggingPosition }, ref) => {
    const videoRef = React.useRef<HTMLVideoElement>(null)
    const canvasRef = React.useRef<HTMLCanvasElement>(null)
    const containerRef = React.useRef<HTMLDivElement>(null)

    const [isPlaying, setIsPlaying] = React.useState(false)
    const [currentTime, setCurrentTime] = React.useState(0)
    const [duration, setDuration] = React.useState(0)
    const [volume, setVolume] = React.useState(1)
    const [isMuted, setIsMuted] = React.useState(false)
    const [hoverPosition, setHoverPosition] = React.useState<{x: number, y: number} | null>(null);

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

    const calculateClickPosition = (e: React.MouseEvent<HTMLElement>) => {
      const video = videoRef.current;
      if (!video) return null;

      const rect = video.getBoundingClientRect();

      // Get video's rendered size, respecting object-fit: contain
      const videoAspectRatio = video.videoWidth / video.videoHeight;
      const containerAspectRatio = rect.width / rect.height;

      let renderedWidth = rect.width;
      let renderedHeight = rect.height;
      let offsetX = 0;
      let offsetY = 0;

      if (videoAspectRatio > containerAspectRatio) {
        // Video is wider than container, so it's letterboxed (top/bottom bars)
        renderedHeight = rect.width / videoAspectRatio;
        offsetY = (rect.height - renderedHeight) / 2;
      } else {
        // Video is taller than container, so it's pillarboxed (left/right bars)
        renderedWidth = rect.height * videoAspectRatio;
        offsetX = (rect.width - renderedWidth) / 2;
      }
      
      const x = e.clientX - rect.left - offsetX;
      const y = e.clientY - rect.top - offsetY;

      // Only register clicks within the video's visible area
      if (x < 0 || x > renderedWidth || y < 0 || y > renderedHeight) {
        return null;
      }

      const xPercent = (x / renderedWidth) * 100;
      const yPercent = (y / renderedHeight) * 100;
      
      return { x: xPercent, y: yPercent };
    }

    const handleVideoClick = (e: React.MouseEvent<HTMLElement>) => {
      const video = videoRef.current;
      if (!video) return;

      const position = calculateClickPosition(e);
      if (!position) return;
      
      if (!video.paused) {
        video.pause();
        setIsPlaying(false)
      }
      
      onTimestampSelect(video.currentTime, position);
    }
    
    const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
      const position = calculateClickPosition(e);
      setHoverPosition(position);
    }

    const handleMouseLeave = () => {
      setHoverPosition(null);
    }

    React.useEffect(() => {
      const video = videoRef.current;
      if (video) {
        const timeUpdateHandler = () => handleTimeUpdate();
        const loadedMetadataHandler = () => handleLoadedMetadata();
        const playHandler = () => setIsPlaying(true);
        const pauseHandler = () => setIsPlaying(false);

        video.addEventListener("timeupdate", timeUpdateHandler);
        video.addEventListener("loadedmetadata", loadedMetadataHandler);
        video.addEventListener("play", playHandler);
        video.addEventListener("pause", pauseHandler);
        
        return () => {
            video.removeEventListener("timeupdate", timeUpdateHandler);
            video.removeEventListener("loadedmetadata", loadedMetadataHandler);
            video.removeEventListener("play", playHandler);
            video.removeEventListener("pause", pauseHandler);
        };
      }
    }, [])

    return (
      <div 
        ref={containerRef} 
        className="relative flex h-full w-full flex-col items-center justify-center bg-black cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleVideoClick}
      >
        <video
          ref={videoRef}
          src={videoSrc}
          className="max-h-full w-full object-contain pointer-events-none"
        />
        <canvas ref={canvasRef} className="hidden" />

        {taggingPosition && <TagPin position={taggingPosition} />}

        {hoverPosition && !taggingPosition && <TagPin position={hoverPosition} isHover />}

        {tags.map((tag) => (
          <TagPin key={tag.id} position={tag.position} />
        ))}

        <div 
          className="absolute bottom-0 left-0 right-0 flex flex-col gap-2 bg-gradient-to-t from-black/70 to-transparent p-4 text-white opacity-0 transition-opacity duration-300 hover:opacity-100 focus-within:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
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
            <div className="ml-auto flex w-32 items-center gap-2">
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
