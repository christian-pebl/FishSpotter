
"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Upload } from "lucide-react"

interface UploadDialogProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  onUpload: (videos: FileList) => void
}

export default function UploadDialog({ isOpen, onOpenChange, onUpload }: UploadDialogProps) {
  const [selectedFiles, setSelectedFiles] = React.useState<FileList | null>(null)
  const { toast } = useToast()

  React.useEffect(() => {
    if (isOpen) {
      setSelectedFiles(null)
    }
  }, [isOpen])

  const handleUploadClick = () => {
    if (selectedFiles && selectedFiles.length > 0) {
      onUpload(selectedFiles)
    } else {
      toast({
        variant: "destructive",
        title: "No files selected",
        description: "Please choose video files to upload.",
      })
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Upload Videos</DialogTitle>
          <DialogDescription>
            Select up to 10 video files to add to the queue.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="video-files">Video Files</Label>
            <Input 
              id="video-files" 
              type="file" 
              multiple 
              accept="video/*"
              onChange={(e) => setSelectedFiles(e.target.files)}
            />
          </div>
        </div>
        <DialogFooter>
            <Button type="button" onClick={handleUploadClick}>
                <Upload className="mr-2 h-4 w-4" />
                Upload
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
