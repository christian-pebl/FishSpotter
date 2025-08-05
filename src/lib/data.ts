import type { Video, Tag } from './types';

// This file is now unused but kept for reference.
// The application now fetches data directly from Firestore.

export const MOCK_VIDEOS: Video[] = [
  {
    id: 'vid-1',
    title: 'Coral Reef Exploration',
    srcUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    thumbnailUrl: 'https://placehold.co/160x90.png',
    duration: 15,
  },
  {
    id: 'vid-2',
    title: 'Deep Sea Vents',
    srcUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    thumbnailUrl: 'https://placehold.co/160x90.png',
    duration: 15,
  },
  {
    id: 'vid-3',
    title: 'Kelp Forest Dive',
    srcUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    thumbnailUrl: 'https://placehold.co/160x90.png',
    duration: 60,
  },
    {
    id: 'vid-4',
    title: 'Open Ocean Giants',
    srcUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    thumbnailUrl: 'https://placehold.co/160x90.png',
    duration: 15,
  },
];

export const MOCK_TAGS: Tag[] = [];

    