"use client"

import { supabase } from './supabase'

export interface UploadProgress {
  progress: number;
  speed: number;
  bytesTransferred: number;
  totalBytes: number;
}

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

export async function uploadVideoToSupabase(
  file: File,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  
  try {
    // Check file size limit (50MB for Supabase free tier)
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes
    if (file.size > MAX_FILE_SIZE) {
      const fileSizeMB = Math.round(file.size / 1024 / 1024);
      return {
        success: false,
        error: `File too large (${fileSizeMB}MB). Maximum size is 50MB on free tier. Please compress your video or upgrade to Supabase Pro.`
      };
    }

    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
    const filePath = `videos/${fileName}`
    
    console.log(`🟢 Starting Supabase upload for: ${file.name}`);
    console.log(`📁 File path: ${filePath}`);
    console.log(`📁 File size: ${file.size} bytes`);
    
    // Check Supabase client authentication
    const { data: { user } } = await supabase.auth.getUser();
    console.log(`👤 Authenticated user:`, user?.id || 'Not authenticated');
    
    // Simulate progress updates since Supabase doesn't provide native upload progress
    if (onProgress) {
      console.log(`📊 Setting up progress tracking...`);
      
      const simulateProgress = () => {
        console.log(`📈 Starting progress simulation...`);
        let progress = 0;
        const interval = setInterval(() => {
          progress += Math.random() * 10;
          if (progress >= 95) {
            clearInterval(interval);
            return;
          }
          
          onProgress({
            progress: Math.min(progress, 95),
            speed: Math.random() * 1000, // KB/s
            bytesTransferred: Math.floor((progress / 100) * file.size),
            totalBytes: file.size
          });
        }, 200);
        
        return interval;
      };
      
      const progressInterval = simulateProgress();
      
      // Upload the file
      console.log(`⬆️ Starting actual Supabase upload...`);
      const { data, error } = await supabase.storage
        .from('videos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });
      
      console.log(`📦 Upload response:`, { data, error });
      
      clearInterval(progressInterval);
      
      // Complete progress
      onProgress({
        progress: 100,
        speed: 0,
        bytesTransferred: file.size,
        totalBytes: file.size
      });
      
      if (error) {
        console.error(`❌ Supabase upload error:`, error);
        return {
          success: false,
          error: error.message
        };
      }
      
      // Get the public URL
      const { data: urlData } = supabase.storage
        .from('videos')
        .getPublicUrl(filePath);
      
      console.log(`✅ Upload successful: ${urlData.publicUrl}`);
      
      return {
        success: true,
        url: urlData.publicUrl
      };
      
    } else {
      // Upload without progress tracking
      console.log(`⬆️ Starting Supabase upload (no progress tracking)...`);
      const { data, error } = await supabase.storage
        .from('videos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });
      
      console.log(`📦 Upload response:`, { data, error });
      
      if (error) {
        console.error(`❌ Supabase upload error:`, error);
        return {
          success: false,
          error: error.message
        };
      }
      
      // Get the public URL
      const { data: urlData } = supabase.storage
        .from('videos')
        .getPublicUrl(filePath);
      
      console.log(`✅ Upload successful: ${urlData.publicUrl}`);
      
      return {
        success: true,
        url: urlData.publicUrl
      };
    }
    
  } catch (error) {
    console.error('🔥 Upload setup error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload setup failed'
    };
  }
}