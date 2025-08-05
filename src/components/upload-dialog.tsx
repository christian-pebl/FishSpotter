
"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Upload } from "lucide-react"

const ACCESS_CODE = "Turbot2025"

interface UploadDialogProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  onUpload: (videos: FileList) => void
}

export default function UploadDialog({ isOpen, onOpenChange, onUpload }: UploadDialogProps) {
  const [accessCode, setAccessCode] = React.useState("")
  const [showAccess, setShowAccess] = React.useState(true)
  const [selectedFiles, setSelectedFiles] = React.useState<FileList | null>(null)
  const { toast } = useToast()

  React.useEffect(() => {
    if (isOpen) {
      setAccessCode("")
      setSelectedFiles(null)
      setShowAccess(true)
    }
  }, [isOpen])

  const handleAccessCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (accessCode === ACCESS_CODE) {
      setShowAccess(false)
    } else {
      toast({
        variant: "destructive",
        title: "Access Denied",
        description: "The access code is incorrect.",
      })
    }
  }

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
            {showAccess
              ? "Enter the access code to upload new videos for tagging."
              : "Select up to 10 video files to add to the queue."}
          </DialogDescription>
        </DialogHeader>
        {showAccess ? (
          <form onSubmit={handleAccessCodeSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="access-code" className="text-right">
                  Access Code
                </Label>
                <Input
                  id="access-code"
                  type="password"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  className="col-span-3"
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">Submit</Button>
            </DialogFooter>
          </form>
        ) : (
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
            <DialogFooter>
                <Button type="button" onClick={handleUploadClick}>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload
                </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
