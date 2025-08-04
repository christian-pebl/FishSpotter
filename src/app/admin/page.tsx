
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { MOCK_TAGS, MOCK_VIDEOS } from "@/lib/data"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import AppHeader from "@/components/app-header"
import { formatTimestamp } from "@/lib/utils"

export default function AdminPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  React.useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    } else if (!loading && user && user.role !== 'admin') {
      router.push('/')
    }
  }, [user, loading, router])

  if (loading || !user || user.role !== 'admin') {
    return (
      <div className="flex h-screen items-center justify-center">
        <p>Loading or Access Denied...</p>
      </div>
    );
  }
  
  const videoMap = new Map(MOCK_VIDEOS.map(v => [v.id, v.title]));

  return (
    <div className="flex h-screen w-full flex-col">
      <AppHeader />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="mx-auto max-w-7xl">
          <Card>
            <CardHeader>
              <CardTitle>Admin Dashboard</CardTitle>
              <CardDescription>View all tags submitted by users across all videos.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Video</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Tag</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Position</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MOCK_TAGS.map((tag) => (
                    <TableRow key={tag.id}>
                      <TableCell className="font-medium">{videoMap.get(tag.videoId) || 'Unknown Video'}</TableCell>
                      <TableCell>{formatTimestamp(tag.timestamp)}</TableCell>
                      <TableCell>{tag.text}</TableCell>
                      <TableCell>{tag.username}</TableCell>
                      <TableCell>({tag.position.x.toFixed(1)}%, {tag.position.y.toFixed(1)}%)</TableCell>
                    </TableRow>
                  ))}
                </Body>
              </Table>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
