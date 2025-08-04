
"use client"

import * as React from "react"
import { formatTimestamp } from "@/lib/utils"
import type { Tag } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Edit, Save, Trash2, X, User, MapPin } from "lucide-react"
import { Card } from "@/components/ui/card"

interface TagListProps {
  tags: Tag[]
  onUpdateTag: (tag: Tag) => void
  onDeleteTag: (tagId: string) => void
  onTagSelect: (tag: Tag) => void
}

function TagListItem({ tag, onUpdateTag, onDeleteTag, onTagSelect }: { tag: Tag, onUpdateTag: (tag: Tag) => void, onDeleteTag: (tagId: string) => void, onTagSelect: (tag: Tag) => void }) {
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
  
  const handleTagClick = (e: React.MouseEvent) => {
    if (!isEditing) {
        // Stop propagation to prevent Accordion from opening/closing
        e.stopPropagation();
        onTagSelect(tag);
    }
  }

  return (
    <AccordionItem value={tag.id} className="border-b-0">
        <Card className="mb-2">
            <div className="flex w-full items-center justify-between p-3" >
              <div className="flex-1 flex items-center justify-start gap-4 cursor-pointer" onClick={handleTagClick}>
                  <span className="font-code text-sm font-semibold text-primary">{formatTimestamp(tag.timestamp)}</span>
                  {isEditing ? (
                      <Input
                          type="text"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onKeyDown={handleKeyDown}
                          onClick={(e) => e.stopPropagation()}
                          className="mx-2 h-8 flex-1"
                          autoFocus
                      />
                  ) : (
                      <p className="px-0 text-left text-foreground">{tag.text}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                    <AccordionTrigger className="p-1 hover:no-underline [&[data-state=open]>svg]:rotate-180">
                        <span className="sr-only">Details</span>
                    </AccordionTrigger>
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
            </div>
            <AccordionContent className="p-3 pt-0">
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span>Tagged by {tag.username}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>Position: ({tag.position.x.toFixed(1)}%, {tag.position.y.toFixed(1)}%)</span>
                  </div>
                </div>
            </AccordionContent>
        </Card>
    </AccordionItem>
  )
}

export default function TagList({ tags, onUpdateTag, onDeleteTag, onTagSelect }: TagListProps) {
  if (tags.length === 0) {
    return (
      <div className="flex h-full min-h-[150px] flex-col items-center justify-center rounded-md border-2 border-dashed">
        <p className="text-center text-muted-foreground">No tags for this video yet.</p>
        <p className="text-center text-sm text-muted-foreground">Click the video to create one.</p>
      </div>
    )
  }

  return (
    <ScrollArea className="h-[calc(100vh-250px)] max-h-[500px] w-full pr-4 md:max-h-full">
      <Accordion type="single" collapsible className="w-full space-y-0">
        {tags.map((tag) => (
          <TagListItem key={tag.id} tag={tag} onUpdateTag={onUpdateTag} onDeleteTag={onDeleteTag} onTagSelect={onTagSelect} />
        ))}
      </Accordion>
    </ScrollArea>
  )
}
