"use client"

import * as React from "react"
import { Wand2, Loader2, Tag, X } from "lucide-react"
import { useForm, type SubmitHandler } from "react-hook-form"
import { cn } from "@/lib/utils"

import { getTagSuggestions } from "@/lib/actions"
import { formatTimestamp } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import type { VideoPlayerRef } from "./video-player"

interface TaggingFormProps extends React.HTMLAttributes<HTMLDivElement> {
  selectedTimestamp: number | null
  videoPlayerRef: React.RefObject<VideoPlayerRef>
  onTagAdd: (tagText: string) => void
  onCancel: () => void
}

type Inputs = {
  tagText: string
}

export default function TaggingForm({ selectedTimestamp, videoPlayerRef, onTagAdd, onCancel, className, ...props }: TaggingFormProps) {
  const { register, handleSubmit, setValue, reset, watch, setFocus } = useForm<Inputs>()
  const { toast } = useToast()
  const [isSuggesting, setIsSuggesting] = React.useState(false)
  const [suggestions, setSuggestions] = React.useState<string[]>([])

  const tagTextValue = watch("tagText")

  React.useEffect(() => {
    // Clear suggestions when user starts typing
    if (tagTextValue) {
      setSuggestions([])
    }
  }, [tagTextValue])
  
  React.useEffect(() => {
    // Reset form when timestamp changes
    reset()
    setSuggestions([])
    setFocus("tagText")
    
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
            onCancel()
        }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)

  }, [selectedTimestamp, reset, setFocus, onCancel])


  const handleSuggest = async () => {
    if (!videoPlayerRef.current) return
    
    setIsSuggesting(true)
    setSuggestions([])
    try {
      const frameData = videoPlayerRef.current.captureFrame()
      if(!frameData) {
        toast({
          variant: "destructive",
          title: "Could not capture frame",
          description: "Please try playing the video for a moment.",
        })
        return;
      }
      const suggestedTags = await getTagSuggestions(frameData)
      setSuggestions(suggestedTags)
      if(suggestedTags.length === 0) {
        toast({ title: "No suggestions found", description: "The AI couldn't identify a species. Try a different frame."})
      }
    } catch (error) {
      console.error(error)
      toast({
        variant: "destructive",
        title: "Suggestion failed",
        description: "An error occurred while getting AI suggestions.",
      })
    } finally {
      setIsSuggesting(false)
    }
  }

  const onSubmit: SubmitHandler<Inputs> = (data) => {
    onTagAdd(data.tagText)
    reset()
  }

  if (selectedTimestamp === null) {
    return null
  }

  return (
    <div 
        className={cn("w-full space-y-2 rounded-lg border bg-card p-4 shadow-sm", className)}
        {...props}
    >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="font-semibold">Add Tag</h3>
                <span className="font-code text-sm text-primary">{formatTimestamp(selectedTimestamp)}</span>
            </div>
            
            <div className="flex items-center gap-2">
            <Input
                id="tagText"
                {...register("tagText", { required: true })}
                placeholder="Enter species name..."
                autoComplete="off"
                className="h-9 text-sm"
            />
            <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleSuggest}
                disabled={isSuggesting}
                className="h-9 w-9 shrink-0"
                aria-label="Suggest Tag"
            >
                {isSuggesting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                <Wand2 className="h-4 w-4" />
                )}
            </Button>
            </div>

            {suggestions.length > 0 && (
                <div className="flex flex-wrap gap-1">
                {suggestions.map((suggestion) => (
                    <Badge 
                    key={suggestion}
                    variant="secondary"
                    className="cursor-pointer px-2 py-0.5 text-xs hover:bg-primary/20"
                    onClick={() => setValue("tagText", suggestion, {shouldDirty: true})}
                    >
                    {suggestion}
                    </Badge>
                ))}
                </div>
            )}
            
            <div className="flex gap-2">
              <Button type="submit" size="sm" className="h-9 w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={!tagTextValue}>
                  <Tag className="mr-2 h-4 w-4" /> Add Tag
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-9 w-full" onClick={onCancel}>
                  <X className="mr-2 h-4 w-4" /> Cancel
              </Button>
            </div>
        </form>
    </div>
  )
}
