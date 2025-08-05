
"use client"

import * as React from "react"
import { CheckCircle2, Edit, FileVideo, Loader2, Save, Trash2, X, AlertTriangle, FileText, ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ScrollArea } from "./ui/scroll-area"

export interface UploadingVideo {
  id: string;
  name: string;
  status: 'uploading' | 'complete' | 'error';
  progress: number;
  speed: number;
  logs: string[];
  fileBuffer?: Uint8Array;
  fileType?: string;
}

interface VideoQueueProps {
  videos: UploadingVideo[];
  onRename: (id: string, newName: string) => void;
  onDelete: (id: string) => void;
}

function QueueItem({ video, onRename, onDelete }: { video: UploadingVideo; onRename: (id: string, newName: string) => void; onDelete: (id: string) => void; }) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [isLogOpen, setIsLogOpen] = React.useState(false);
  const [name, setName] = React.useState(video.name);
  const logContainerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [video.logs]);

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
  
  const formatSpeed = (speed: number) => {
      if (speed <= 0) return ""
      if (speed < 1024) return `${speed.toFixed(2)} KB/s`
      return `${(speed / 1024).toFixed(2)} MB/s`
  }

  return (
    <Collapsible open={isLogOpen} onOpenChange={setIsLogOpen}>
    <div className={cn("p-3 rounded-lg border", 
        video.status === 'error' ? 'border-destructive/50' : isLogOpen && "bg-muted/50"
    )}>
        <div className="flex items-center gap-4">
        <FileVideo className="h-6 w-6 text-muted-foreground" />
        <div className="flex-1 space-y-1 overflow-hidden">
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
                <Progress value={video.progress} className={cn("h-1.5 w-full", video.status === 'error' && "bg-destructive/50" )} />
                <span className="text-xs font-mono text-muted-foreground w-10 text-right">{video.progress.toFixed(0)}%</span>
            </div>
            {video.status === 'uploading' && (
                <p className="text-xs text-muted-foreground font-mono">{formatSpeed(video.speed)}</p>
            )}
        </div>
        <div className="flex items-center gap-1">
            <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon">
                    <FileText className="h-4 w-4" />
                    <span className="sr-only">Toggle logs</span>
                </Button>
            </CollapsibleTrigger>
            
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
                <>
                <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)} aria-label="Rename video" disabled={isEditing || video.status === 'uploading'}>
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
                        This will remove the video "{video.name}" from the queue. If it has already been uploaded, it will not be deleted from storage.
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
            )}
            <div className="w-6 h-6 flex items-center justify-center">
                {video.status === 'uploading' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                {video.status === 'complete' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                {video.status === 'error' && <AlertTriangle className="h-4 w-4 text-destructive" />}
            </div>
        </div>
        </div>
        <CollapsibleContent>
            <div className="mt-2 rounded-md border bg-background p-2">
                 <ScrollArea className="h-32" ref={logContainerRef}>
                    <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap p-2 break-words">
                        {video.logs.join("\n")}
                    </pre>
                 </ScrollArea>
            </div>
        </CollapsibleContent>
    </div>
    </Collapsible>
  );
}


export default function VideoQueue({ videos, onRename, onDelete }: VideoQueueProps) {
    if (videos.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center gap-2 text-center text-muted-foreground border-2 border-dashed rounded-lg p-8 h-full">
                <FileVideo className="h-10 w-10" />
                <h3 className="font-semibold">No Videos in Queue</h3>
                <p className="text-sm">Upload videos to see the queue here.</p>
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
