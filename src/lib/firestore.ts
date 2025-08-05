
import { collection, getDocs, query, where, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { User, Tag, Video } from "@/lib/types";

export async function getAllUsersWithTags(): Promise<(User & { tags: Tag[] })[]> {
    const usersCollectionRef = collection(db, "users");
    const tagsCollectionRef = collection(db, "tags");

    const [userSnapshot, tagSnapshot] = await Promise.all([
        getDocs(usersCollectionRef),
        getDocs(tagsCollectionRef)
    ]);

    const allUsers = userSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
    const allTags = tagSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tag));

    return allUsers.map(user => {
        const userTags = allTags.filter(tag => tag.userId === user.id);
        return {
            ...user,
            tags: userTags
        };
    });
}

export async function getAllVideos(): Promise<Video[]> {
    const videosCollectionRef = collection(db, "videos");
    const videoSnapshot = await getDocs(videosCollectionRef);
    return videoSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Video));
}

export async function getTagsForVideo(videoId: string): Promise<Tag[]> {
    const tagsCollectionRef = collection(db, "tags");
    const q = query(tagsCollectionRef, where("videoId", "==", videoId));
    const tagSnapshot = await getDocs(q);
    return tagSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tag));
}

export async function createVideoDocument(videoData: Omit<Video, 'id'>): Promise<Video> {
  const docRef = await addDoc(collection(db, "videos"), videoData);
  return {
    id: docRef.id,
    ...videoData
  };
}
