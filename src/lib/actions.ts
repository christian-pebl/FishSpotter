
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
    return []
  }
}

export async function uploadFile(
  videoId: string,
  file: File,
  onProgress: (progress: number, speed: number) => void,
  addLog: (id: string, log: string) => void
): Promise<{ success: boolean; downloadURL?: string; error?: string }> {
  return new Promise((resolve, reject) => {
    if (!file) {
      const errorMsg = 'No file provided for upload.';
      addLog(videoId, errorMsg);
      return reject({ success: false, error: errorMsg });
    }

    const filePath = `videos/${uuidv4()}-${file.name}`;
    addLog(videoId, `Generated file path: ${filePath}`);
    const storageRef = ref(storage, filePath);
    addLog(videoId, "Storage reference created. Starting upload task...");
    const uploadTask = uploadBytesResumable(storageRef, file);

    let lastBytesTransferred = 0;
    let lastTimestamp = Date.now();

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        
        const now = Date.now();
        const timeDiff = (now - lastTimestamp) / 1000; // in seconds
        const bytesDiff = snapshot.bytesTransferred - lastBytesTransferred;
        
        // speed in KB/s
        const speed = timeDiff > 0 ? (bytesDiff / 1024) / timeDiff : 0; 

        onProgress(progress, speed);
        
        lastBytesTransferred = snapshot.bytesTransferred;
        lastTimestamp = now;

        switch (snapshot.state) {
          case 'paused':
            addLog(videoId, 'Upload is paused.');
            break;
          case 'running':
            // This log is too noisy, progress is logged in onProgress callback
            break;
        }
      },
      (error) => {
        console.error('Upload failed:', error);
        const errorMsg = `Upload failed: ${error.code} - ${error.message}`;
        addLog(videoId, errorMsg);
        reject({ success: false, error: errorMsg });
      },
      async () => {
        addLog(videoId, "Upload finished. Getting download URL...");
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          addLog(videoId, "Download URL retrieved successfully.");
          resolve({ success: true, downloadURL });
        } catch (error: any) {
          console.error('Failed to get download URL:', error);
          const errorMsg = `Failed to get download URL: ${error.code} - ${error.message}`;
          addLog(videoId, errorMsg);
          reject({ success: false, error: errorMsg });
        }
      }
    );
  });
}

export async function createVideoDocument(videoData: Omit<Video, 'id'>): Promise<Video> {
  const docRef = await addDoc(collection(db, "videos"), videoData);
  return {
    id: docRef.id,
    ...videoData
  };
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
