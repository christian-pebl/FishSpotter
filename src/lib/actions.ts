
"use server"

import { suggestVideoTag, type SuggestVideoTagInput } from "@/ai/flows/suggest-video-tag"
import { adminStorage } from "@/lib/firebase-admin";
import { addDoc, collection } from "firebase/firestore";
import { db } from "./firebase";
import type { Video } from "./types";
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
    // In a real application, you'd want more robust error handling and logging.
    return []
  }
}

export async function uploadVideo(
  formData: FormData
): Promise<{ success: boolean; video?: Video; error?: string }> {
  try {
    const file = formData.get('video') as File;
    if (!file) {
      throw new Error('No file provided');
    }

    const fileName = `${uuidv4()}-${file.name}`;
    const filePath = `videos/${fileName}`;
    
    const bucket = adminStorage.bucket();
    const fileUpload = bucket.file(filePath);

    const stream = fileUpload.createWriteStream({
      metadata: {
        contentType: file.type,
      },
    });

    const buffer = Buffer.from(await file.arrayBuffer());
    
    await new Promise((resolve, reject) => {
      stream.on('error', reject);
      stream.on('finish', resolve);
      stream.end(buffer);
    });

    const [url] = await fileUpload.getSignedUrl({
        action: 'read',
        expires: '03-09-2491' // Far future expiration
    });

    // For simplicity, we'll generate a placeholder thumbnail.
    // In a real app, you would generate one from the video.
    const newVideoData: Omit<Video, 'id' | 'duration'> = {
        title: file.name.replace(/\.[^/.]+$/, ""), // Remove file extension
        srcUrl: url,
        thumbnailUrl: 'https://placehold.co/160x90.png', 
    };

    // To get duration, we'd need a library like fluent-ffmpeg, which is complex for this demo.
    // We'll add it without duration for now. A background function could update it later.

    const docRef = await addDoc(collection(db, "videos"), {
      ...newVideoData,
      duration: 0, // Placeholder
    });
    
    const newVideo: Video = {
      id: docRef.id,
      ...newVideoData,
      duration: 0, // Placeholder
    }

    return { success: true, video: newVideo };

  } catch (error: any) {
    console.error('Upload failed:', error);
    return { success: false, error: error.message };
  }
}
