"use client"

import * as React from "react"
import { Wand2, Loader2, Tag } from "lucide-react"
import { useForm, type SubmitHandler } from "react-hook-form"

import { getTagSuggestions } from "@/lib/actions"
import { formatTimestamp } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import type { VideoPlayerRef } from "./video-player"

interface TaggingFormProps {
  selectedTimestamp: number | null
  videoPlayerRef: React.RefObject<VideoPlayerRef>
  onTagAdd: (tagText: string) => void
}

type Inputs = {
  tagText: string
}

export default function TaggingForm({ selectedTimestamp, videoPlayerRef, onTagAdd }: TaggingFormProps) {
  const { register, handleSubmit, setValue, reset, watch } = useForm<Inputs>()
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
  }, [selectedTimestamp, reset])

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
    return (
      <div className="flex h-48 flex-col items-center justify-center rounded-md border-2 border-dashed">
        <p className="text-center text-muted-foreground">Click on the video at a specific point</p>
        <p className="text-center text-sm text-muted-foreground">to select a timestamp for tagging.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="timestamp">Timestamp</Label>
        <Input
          id="timestamp"
          type="text"
          value={formatTimestamp(selectedTimestamp)}
          readOnly
          className="font-code"
        />
      </div>
      <div>
        <Label htmlFor="tagText">Species Tag</Label>
        <div className="flex items-center gap-2">
          <Input
            id="tagText"
            {...register("tagText", { required: true })}
            placeholder="e.g., Manta Ray, Kelp"
            autoComplete="off"
            autoFocus
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleSuggest}
            disabled={isSuggesting}
            className="shrink-0"
          >
            {isSuggesting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="mr-2 h-4 w-4" />
            )}
            Suggest
          </Button>
        </div>
      </div>

      {suggestions.length > 0 && (
        <div className="space-y-2">
            <Label>Suggestions</Label>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <Badge 
                  key={suggestion}
                  variant="secondary"
                  className="cursor-pointer hover:bg-primary/20"
                  onClick={() => setValue("tagText", suggestion, {shouldDirty: true})}
                >
                  {suggestion}
                </Badge>
              ))}
            </div>
        </div>
      )}

      <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={!tagTextValue}>
        <Tag className="mr-2 h-4 w-4" /> Add Tag
      </Button>
    </form>
  )
}
