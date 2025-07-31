export interface Video {
  id: string;
  title: string;
  srcUrl: string;
  thumbnailUrl: string;
  duration: number; // in seconds
}

export interface Tag {
  id: string;
  videoId: string;
  timestamp: number; // in seconds
  text: string;
  userId: string;
  username: string;
}
