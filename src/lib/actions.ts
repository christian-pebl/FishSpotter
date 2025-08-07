
"use server"

import 'dotenv/config'
import { suggestVideoTag, type SuggestVideoTagInput } from "@/ai/flows/suggest-video-tag"
import { supabase } from "./supabase";
import type { Video, Tag } from "./types";
import { v4 as uuidv4 } from 'uuid';

export async function getTagSuggestions(currentFrame: string): Promise<string[]> {
  if (!currentFrame) {
    return []
  }

  try {
    const input: SuggestVideoTagInput = {
      currentFrame,
    }

    const result = await suggestVideoTag(input)
    return result.suggestedTags || []
  } catch (error) {
    console.error("Error getting AI tag suggestions:", error)
    // Don't rethrow, just return empty array
    return []
  }
}

export async function createVideoDocument(videoData: Omit<Video, 'id'>): Promise<Video> {
  // Convert camelCase to lowercase for database (matching actual columns)
  const dbData = {
    title: videoData.title,
    srcurl: videoData.srcUrl,
    thumbnailurl: videoData.thumbnailUrl,
    duration: videoData.duration
  };

  const { data, error } = await supabase
    .from('videos')
    .insert(dbData)
    .select()
    .single();

  if (error) {
    console.error('Error creating video document:', error);
    throw new Error(error.message);
  }

  // Convert lowercase back to camelCase for frontend
  return {
    id: data.id,
    title: data.title,
    srcUrl: data.srcurl,
    thumbnailUrl: data.thumbnailurl,
    duration: data.duration
  };
}

export async function deleteVideo(video: Video): Promise<{ success: boolean; error?: string }> {
    try {
        // 1. Delete video file from Supabase Storage
        if (video.srcUrl) {
            // Extract file path from URL
            const urlParts = video.srcUrl.split('/');
            const filePath = urlParts[urlParts.length - 1];
            const { error: storageError } = await supabase.storage
                .from('videos')
                .remove([`videos/${filePath}`]);
            
            if (storageError) {
                console.warn('Error deleting video file from storage:', storageError);
            }
        }

        // 2. Delete all associated tags first (foreign key constraint)
        const { error: tagsError } = await supabase
            .from('tags')
            .delete()
            .eq('videoId', video.id);

        if (tagsError) {
            console.warn('Error deleting associated tags:', tagsError);
        }

        // 3. Delete the video document from Supabase
        const { error: videoError } = await supabase
            .from('videos')
            .delete()
            .eq('id', video.id);

        if (videoError) {
            throw new Error(videoError.message);
        }

        return { success: true };

    } catch (error: any) {
        console.error("Error deleting video and associated data:", error);
        return { success: false, error: error.message };
    }
}

// This server action is no longer used for direct upload.
// The primary upload logic is now handled on the client in page.tsx for better progress reporting.
export async function uploadFile(
  videoId: string,
  file: File,
  onProgress: (progress: number, speed: number) => void,
  addLog: (id: string, log: string) => void
): Promise<{ success: boolean; downloadURL?: string; error?: string }> {
    // This function is intentionally left empty as the upload logic has been moved to the client.
    // This avoids confusion and keeps the server action from being used incorrectly.
    console.warn("uploadFile server action is deprecated. Uploads are now handled client-side.");
    return Promise.reject({ success: false, error: 'This upload method is deprecated.' });
}


export async function getVideos(): Promise<Video[]> {
    const { data, error } = await supabase
        .from('videos')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching videos:', error);
        throw new Error(error.message);
    }

    // Convert database lowercase to camelCase for frontend
    return (data || []).map(video => ({
        id: video.id,
        title: video.title,
        srcUrl: video.srcurl,
        thumbnailUrl: video.thumbnailurl,
        duration: video.duration
    }));
}

export async function getTags(): Promise<Tag[]> {
    const { data, error } = await supabase
        .from('tags')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching tags:', error);
        throw new Error(error.message);
    }

    return data || [];
}

export async function saveTags(tags: Tag[]): Promise<void> {
    const tagsWithSubmission = tags.map(tag => ({ 
        ...tag, 
        submitted: true,
        id: undefined // Let Supabase generate the ID
    }));

    const { error } = await supabase
        .from('tags')
        .insert(tagsWithSubmission);

    if (error) {
        console.error('Error saving tags:', error);
        throw new Error(error.message);
    }
}
