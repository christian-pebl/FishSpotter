
"use server"

import 'dotenv/config'
import { suggestVideoTag, type SuggestVideoTagInput } from "@/ai/flows/suggest-video-tag"
import { addDoc, collection, doc, getDocs, writeBatch } from "firebase/firestore";
import { db, storage } from "./firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
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
    // Don't rethrow, just return empty array
    return []
  }
}

// This function is now designed to be called from the client-side `handleUpload` function.
// It creates the database record after the file is already in Storage.
export async function createVideoDocument(videoData: Omit<Video, 'id'>): Promise<Video> {
  const docRef = await addDoc(collection(db, "videos"), videoData);
  return {
    id: docRef.id,
    ...videoData
  };
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
        const tagWithSubmission = { ...tag, submitted: true };
        const docRef = doc(collection(db, "tags"));
        batch.set(docRef, tagWithSubmission);
    });

    await batch.commit();
}
