
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
import { Upload, FileVideo } from "lucide-react"

interface UploadDialogProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  onUpload: (videos: FileList) => void
}

export default function UploadDialog({ isOpen, onOpenChange, onUpload }: UploadDialogProps) {
  const [selectedFiles, setSelectedFiles] = React.useState<FileList | null>(null)
  const { toast } = useToast()
  const fileInputRef = React.useRef<HTMLInputElement>(null)

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFiles(e.target.files)
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
          <Input
            id="video-files"
            type="file"
            multiple
            accept="video/*"
            onChange={handleFileSelect}
            ref={fileInputRef}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
          >
            Choose Files
          </Button>

          {selectedFiles && selectedFiles.length > 0 && (
            <div className="space-y-2">
              <Label>Selected files:</Label>
              <div className="max-h-32 space-y-1 overflow-y-auto rounded-md border p-2">
                {Array.from(selectedFiles).map((file, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileVideo className="h-4 w-4 shrink-0" />
                    <span className="truncate">{file.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            onClick={handleUploadClick}
            disabled={!selectedFiles || selectedFiles.length === 0}
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload {selectedFiles ? selectedFiles.length : ''} {selectedFiles?.length === 1 ? "video" : "videos"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
