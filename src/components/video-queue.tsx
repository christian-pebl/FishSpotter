
"use client"

import * as React from "react"
import { CheckCircle2, Edit, FileVideo, Loader2, Save, Trash2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"

export interface UploadingVideo {
  id: string;
  name: string;
  status: 'uploading' | 'complete' | 'error';
  progress: number;
}

interface VideoQueueProps {
  videos: UploadingVideo[];
  onRename: (id: string, newName: string) => void;
  onDelete: (id: string) => void;
}

function QueueItem({ video, onRename, onDelete }: { video: UploadingVideo; onRename: (id: string, newName: string) => void; onDelete: (id: string) => void; }) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [name, setName] = React.useState(video.name);

  const handleSave = () => {
    onRename(video.id, name);
    setIsEditing(false);
  };
  
  const handleCancel = () => {
    setName(video.name);
    setIsEditing(false);
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') handleCancel();
  };

  return (
    <div className="flex items-center gap-4 p-2 rounded-lg hover:bg-muted/50">
      <FileVideo className="h-6 w-6 text-muted-foreground" />
      <div className="flex-1 space-y-1">
        {isEditing ? (
            <Input 
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={handleKeyDown}
                className="h-8"
                autoFocus
            />
        ) : (
            <p className="text-sm font-medium leading-none truncate">{video.name}</p>
        )}
        <div className="flex items-center gap-2">
          <Progress value={video.progress} className="h-1.5 w-full" />
          <span className="text-xs font-mono text-muted-foreground w-10 text-right">{video.progress}%</span>
        </div>
      </div>
       <div className="flex items-center gap-1">
        {isEditing ? (
           <>
            <Button variant="ghost" size="icon" onClick={handleSave} aria-label="Save video name">
                <Save className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleCancel} aria-label="Cancel edit">
                <X className="h-4 w-4" />
            </Button>
            </>
        ) : (
            video.status === 'complete' && (
                <>
                <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)} aria-label="Rename video">
                    <Edit className="h-4 w-4" />
                </Button>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" aria-label="Delete video">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                        This will delete the video "{video.name}". This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onDelete(video.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                </>
            )
        )}
        {video.status === 'uploading' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {video.status === 'complete' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
      </div>
    </div>
  );
}


export default function VideoQueue({ videos, onRename, onDelete }: VideoQueueProps) {
    if (videos.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center gap-2 text-center text-muted-foreground border-2 border-dashed rounded-lg p-8 h-full">
                <FileVideo className="h-10 w-10" />
                <h3 className="font-semibold">No Videos in Queue</h3>
                <p className="text-sm">Upload videos to start building your library.</p>
            </div>
        )
    }
  
    return (
        <div className="space-y-2">
            {videos.map(video => (
                <QueueItem key={video.id} video={video} onRename={onRename} onDelete={onDelete} />
            ))}
        </div>
    )
}
