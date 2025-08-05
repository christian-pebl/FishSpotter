
"use server"

import 'dotenv/config'
import { suggestVideoTag, type SuggestVideoTagInput } from "@/ai/flows/suggest-video-tag"
import { getAdminStorage } from "@/lib/firebase-admin";
import { addDoc, collection, doc, getDocs, writeBatch } from "firebase/firestore";
import { db } from "./firebase";
import type { Video, Tag } from "./types";
import { v4 as uuidv4 } from 'uuid';
import { getAllVideos as getAllVideosFS, getTagsForVideo as getTagsForVideoFS } from './firestore';

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
    
    const adminStorage = getAdminStorage();
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

    const newVideoData: Omit<Video, 'id' | 'duration'> = {
        title: file.name.replace(/\.[^/.]+$/, ""),
        srcUrl: url,
        thumbnailUrl: 'https://placehold.co/160x90.png', 
    };

    const docRef = await addDoc(collection(db, "videos"), {
      ...newVideoData,
      duration: 0, // Placeholder
    });
    
    const newVideo: Video = {
      id: docRef.id,
      ...newVideoData,
      duration: 0,
    }

    return { success: true, video: newVideo };

  } catch (error: any) {
    console.error('Upload failed:', error);
    return { success: false, error: error.message };
  }
}

export async function getVideos(): Promise<Video[]> {
    return getAllVideosFS();
}

export async function getTags(): Promise<Tag[]> {
    const tagsCollectionRef = collection(db, "tags");
    const snapshot = await getDocs(tagsCollectionRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tag));
}

export async function saveTags(tags: Tag[]): Promise<void> {
    const batch = writeBatch(db);

    tags.forEach(tag => {
        // Mark the tag as submitted before saving
        const tagWithSubmission = { ...tag, submitted: true };
        
        // If the tag has a temporary ID (like `tag-${Date.now()}`), we create a new doc.
        // If it had a real ID from Firestore, we would update it.
        // For this app's logic, we are always creating new tags.
        const docRef = doc(collection(db, "tags"));
        batch.set(docRef, tagWithSubmission);
    });

    await batch.commit();
}

    