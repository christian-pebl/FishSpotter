"use client"

export interface UploadProgress {
  progress: number;
  speed: number;
  bytesTransferred: number;
  totalBytes: number;
}

export interface UploadResult {
  success: boolean;
  url?: string;
  downloadUrl?: string;
  error?: string;
}

export async function uploadVideoToVercel(
  file: File,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  
  const filename = `videos/${Date.now()}-${file.name}`;
  
  try {
    console.log(`🔵 Starting Vercel Blob upload for: ${file.name}`);
    console.log(`📁 File size: ${file.size} bytes`);
    
    // Create upload URL with filename
    const uploadUrl = `/api/upload?filename=${encodeURIComponent(filename)}`;
    
    // Track upload progress using XMLHttpRequest
    return new Promise<UploadResult>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      let startTime = Date.now();
      let lastLoaded = 0;
      
      // Track progress
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const now = Date.now();
          const timeDiff = (now - startTime) / 1000;
          const bytesDiff = event.loaded - lastLoaded;
          const speed = timeDiff > 0 ? (bytesDiff / 1024) / timeDiff : 0;
          
          const progress: UploadProgress = {
            progress: (event.loaded / event.total) * 100,
            speed,
            bytesTransferred: event.loaded,
            totalBytes: event.total
          };
          
          console.log(`📊 Upload progress: ${progress.progress.toFixed(1)}% (${progress.bytesTransferred}/${progress.totalBytes} bytes, ${speed.toFixed(1)} KB/s)`);
          onProgress(progress);
          
          lastLoaded = event.loaded;
          startTime = now;
        }
      });
      
      // Handle completion
      xhr.addEventListener('load', () => {
        try {
          const response = JSON.parse(xhr.responseText);
          if (xhr.status === 200 && response.success) {
            console.log(`✅ Upload completed successfully: ${response.url}`);
            resolve({
              success: true,
              url: response.url,
              downloadUrl: response.downloadUrl
            });
          } else {
            console.error(`❌ Upload failed: ${response.error || 'Unknown error'}`);
            resolve({
              success: false,
              error: response.error || `HTTP ${xhr.status}`
            });
          }
        } catch (parseError) {
          console.error(`❌ Failed to parse response:`, parseError);
          resolve({
            success: false,
            error: 'Invalid server response'
          });
        }
      });
      
      // Handle errors
      xhr.addEventListener('error', () => {
        console.error(`❌ Network error during upload`);
        resolve({
          success: false,
          error: 'Network error'
        });
      });
      
      // Start the upload
      xhr.open('POST', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);
    });
    
  } catch (error) {
    console.error('🔥 Upload setup error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload setup failed'
    };
  }
}