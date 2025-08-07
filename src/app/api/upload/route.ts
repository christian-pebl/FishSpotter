import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');

    if (!filename) {
      return NextResponse.json(
        { error: 'Filename is required' },
        { status: 400 }
      );
    }

    if (!request.body) {
      return NextResponse.json(
        { error: 'No file data provided' },
        { status: 400 }
      );
    }

    console.log(`🔵 Starting Vercel Blob upload for: ${filename}`);
    
    const blob = await put(filename, request.body, {
      access: 'public',
      contentType: request.headers.get('content-type') || 'video/mp4',
    });

    console.log(`✅ Upload successful: ${blob.url}`);

    return NextResponse.json({
      success: true,
      url: blob.url,
      downloadUrl: blob.downloadUrl,
    });

  } catch (error) {
    console.error('🔥 Vercel Blob upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}