import type { Video, Tag } from './types';

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

export const MOCK_TAGS: Tag[] = [
  {
    id: 'tag-1',
    videoId: 'vid-1',
    timestamp: 2.5,
    text: 'Clownfish',
    userId: 'user-1',
    username: 'MarineExplorer',
    position: { x: 50, y: 50 },
  },
  {
    id: 'tag-2',
    videoId: 'vid-1',
    timestamp: 7.1,
    text: 'Sea Anemone',
    userId: 'user-2',
    username: 'DeepDiver',
    position: { x: 30, y: 70 },
  },
  {
    id: 'tag-3',
    videoId: 'vid-1',
    timestamp: 11.8,
    text: 'Brain Coral',
    userId: 'user-1',
    username: 'MarineExplorer',
    position: { x: 75, y: 60 },
  },
  {
    id: 'tag-4',
    videoId: 'vid-2',
    timestamp: 5.2,
    text: 'Tube Worms',
    userId: 'user-2',
    username: 'DeepDiver',
    position: { x: 20, y: 40 },
  },
  {
    id: 'tag-5',
    videoId: 'vid-3',
    timestamp: 18.9,
    text: 'Sea Otter',
    userId: 'user-1',
    username: 'MarineExplorer',
    position: { x: 60, y: 30 },
  },
  {
    id: 'tag-6',
    videoId: 'vid-3',
    timestamp: 45.1,
    text: 'Garibaldi',
    userId: 'user-1',
    username: 'MarineExplorer',
    position: { x: 40, y: 80 },
  },
].sort((a,b) => a.timestamp - b.timestamp);
