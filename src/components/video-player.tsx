
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

const TagPin = ({ position, isHover = false, isNew = false }: { position: { x: number; y: number }, isHover?: boolean, isNew?: boolean }) => (
  <div
    className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
    style={{
      left: `${position.x}%`,
      top: `${position.y}%`,
      pointerEvents: 'none',
    }}
  >
    <div className={`relative h-6 w-6 ${isHover ? 'opacity-70' : ''} transition-opacity`}>
      <div className={`absolute left-1/2 top-0 h-1/2 w-0.5 -translate-x-1/2 ${isNew ? 'bg-yellow-300' : 'bg-red-500/80'}`} />
      <div className={`absolute left-1/2 bottom-0 h-1/2 w-0.5 -translate-x-1/2 ${isNew ? 'bg-yellow-300' : 'bg-red-500/80'}`} />
      <div className={`absolute top-1/2 left-0 h-0.5 w-1/2 -translate-y-1/2 ${isNew ? 'bg-yellow-300' : 'bg-red-500/80'}`} />
      <div className={`absolute top-1/2 right-0 h-0.5 w-1/2 -translate-y-1/2 ${isNew ? 'bg-yellow-300' : 'bg-red-500/80'}`} />
      <div className={`absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${isNew ? 'bg-yellow-300' : 'bg-red-500/80'}`} />
    </div>
  </div>
);


const VideoPlayer = React.forwardRef<VideoPlayerRef, VideoPlayerProps>(
  ({ videoSrc, onTimestampSelect, tags, taggingPosition, onCancelTag }, ref) => {
    const videoRef = React.useRef<HTMLVideoElement>(null)
    const canvasRef = React.useRef<HTMLCanvasElement>(null)
    const containerRef = React.useRef<HTMLDivElement>(null)

    const [isPlaying, setIsPlaying] = React.useState(false)
    const [currentTime, setCurrentTime] = React.useState(0)
    const [duration, setDuration] = React.useState(0)
    const [volume, setVolume] = React.useState(1)
    const [isMuted, setIsMuted] = React.useState(false)
    const [hoverPosition, setHoverPosition] = React.useState<{x: number, y: number} | null>(null);
    const [aspectRatio, setAspectRatio] = React.useState<number>(16/9);

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
        setAspectRatio(videoRef.current.videoWidth / videoRef.current.videoHeight);
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
      const container = containerRef.current
      const video = videoRef.current
      if (!container || !video) return null

      const containerRect = container.getBoundingClientRect()
      
      const videoAspectRatio = video.videoWidth / video.videoHeight
      const containerAspectRatio = containerRect.width / containerRect.height

      let renderWidth = containerRect.width
      let renderHeight = containerRect.height
      let offsetX = 0
      let offsetY = 0

      if (videoAspectRatio > containerAspectRatio) { // Video is wider than container (letterbox)
        renderHeight = containerRect.width / videoAspectRatio
        offsetY = (containerRect.height - renderHeight) / 2
      } else { // Video is taller than container (pillarbox)
        renderWidth = containerRect.height * videoAspectRatio
        offsetX = (containerRect.width - renderWidth) / 2
      }
      
      const clickX = e.clientX - containerRect.left - offsetX
      const clickY = e.clientY - containerRect.top - offsetY

      if (clickX < 0 || clickX > renderWidth || clickY < 0 || clickY > renderHeight) {
        return null;
      }
      
      const xPercent = (clickX / renderWidth) * 100
      const yPercent = (clickY / renderHeight) * 100
      
      return { x: xPercent, y: yPercent }
    }


    const handleVideoClick = (e: React.MouseEvent<HTMLElement>) => {
      if (taggingPosition) {
        onCancelTag()
        return
      }

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
        
        video.load();

        return () => {
            video.removeEventListener("timeupdate", timeUpdateHandler);
            video.removeEventListener("loadedmetadata", loadedMetadataHandler);
            video.removeEventListener("play", playHandler);
            video.removeEventListener("pause", pauseHandler);
        };
      }
    }, [videoSrc])

    return (
      <div 
        ref={containerRef} 
        className="relative w-full h-full flex items-center justify-center bg-black"
        style={{ aspectRatio: `${aspectRatio}` }}
      >
        <div 
          className="relative w-full h-full cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleVideoClick}
        >
          <video
            ref={videoRef}
            src={videoSrc}
            className="w-full h-full object-contain pointer-events-none"
          />
          <canvas ref={canvasRef} className="hidden" />

          {taggingPosition && <TagPin position={taggingPosition} isNew />}

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
      </div>
    )
  }
)

VideoPlayer.displayName = "VideoPlayer"
export default VideoPlayer

    

    


