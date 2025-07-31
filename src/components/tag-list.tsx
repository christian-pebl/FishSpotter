"use client"

import * as React from "react"
import { formatTimestamp } from "@/lib/utils"
import type { Tag } from "@/lib/types"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Edit, Save, Trash2, X } from "lucide-react"

interface TagListProps {
  tags: Tag[]
  onUpdateTag: (tag: Tag) => void
  onDeleteTag: (tagId: string) => void
}

function TagListItem({ tag, onUpdateTag, onDeleteTag }: { tag: Tag, onUpdateTag: (tag: Tag) => void, onDeleteTag: (tagId: string) => void }) {
  const [isEditing, setIsEditing] = React.useState(false)
  const [editText, setEditText] = React.useState(tag.text)

  const handleSave = () => {
    onUpdateTag({ ...tag, text: editText })
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditText(tag.text)
    setIsEditing(false)
  }
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') handleCancel();
  }

  return (
    <Card className="mb-2">
      <CardContent className="flex items-center justify-between p-3">
        <div className="flex flex-col">
          <span className="font-code text-sm font-semibold text-primary">{formatTimestamp(tag.timestamp)}</span>
          {isEditing ? (
            <Input
              type="text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={handleKeyDown}
              className="mt-1 h-8"
              autoFocus
            />
          ) : (
            <p className="text-foreground">{tag.text}</p>
          )}
          <span className="text-xs text-muted-foreground">by {tag.username}</span>
        </div>
        <div className="flex items-center gap-1">
          {isEditing ? (
            <>
              <Button variant="ghost" size="icon" onClick={handleSave} aria-label="Save tag">
                <Save className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleCancel} aria-label="Cancel edit">
                <X className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)} aria-label="Edit tag">
                <Edit className="h-4 w-4" />
              </Button>
               <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" aria-label="Delete tag">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete the tag "{tag.text}".
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDeleteTag(tag.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default function TagList({ tags, onUpdateTag, onDeleteTag }: TagListProps) {
  if (tags.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center rounded-md border-2 border-dashed">
        <p className="text-muted-foreground">No tags for this video yet.</p>
        <p className="text-sm text-muted-foreground">Click the video to create one.</p>
      </div>
    )
  }

  return (
    <ScrollArea className="h-[400px] w-full pr-4">
      {tags.map((tag) => (
        <TagListItem key={tag.id} tag={tag} onUpdateTag={onUpdateTag} onDeleteTag={onDeleteTag} />
      ))}
    </ScrollArea>
  )
}
