-- FishSpotter Database Restoration Script
-- Run this in your NEW Supabase project's SQL Editor
-- Extracted from backup: db_cluster-14-08-2025@00-36-11.backup

-- ==================================================
-- STEP 1: Create Tables
-- ==================================================

CREATE TABLE public.tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    videoid uuid,
    "timestamp" numeric NOT NULL,
    text text NOT NULL,
    userid text NOT NULL,
    username text NOT NULL,
    "position" jsonb NOT NULL,
    submitted boolean DEFAULT false
);

CREATE TABLE public.videos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    title text NOT NULL,
    srcurl text NOT NULL,
    thumbnailurl text,
    duration numeric DEFAULT 0
);

-- ==================================================
-- STEP 2: Add Primary Keys
-- ==================================================

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.videos
    ADD CONSTRAINT videos_pkey PRIMARY KEY (id);

-- ==================================================
-- STEP 3: Add Foreign Keys
-- ==================================================

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_videoid_fkey FOREIGN KEY (videoid) REFERENCES public.videos(id) ON DELETE CASCADE;

-- ==================================================
-- STEP 4: Insert Data
-- ==================================================

-- Insert video data
INSERT INTO public.videos (id, created_at, title, srcurl, thumbnailurl, duration) VALUES
('7514d66a-959c-485d-b4f4-b83c8bfd26a0', '2025-08-07 11:21:32.997123+00', 'clip_ALG_SC_14_2024-06-06_12-00-40_00-00-19_jelly fish', 'https://xwumwtvqppylmzcytuyj.supabase.co/storage/v1/object/public/videos/videos/1754565692298-rkfh1eyekrd.mp4', 'https://placehold.co/160x90.png', 0);

-- Note: tags table is empty in the backup

-- ==================================================
-- STEP 5: Enable Row Level Security
-- ==================================================

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

-- ==================================================
-- STEP 6: Create RLS Policies (Allow all operations)
-- ==================================================

CREATE POLICY "Allow all operations on tags" ON public.tags
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all operations on videos" ON public.videos
    USING (true)
    WITH CHECK (true);

-- ==================================================
-- STEP 7: Create Storage Bucket for Videos
-- ==================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('videos', 'videos', true, NULL, NULL);

-- ==================================================
-- STEP 8: Storage RLS Policies
-- ==================================================

CREATE POLICY "Public can view videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'videos');

CREATE POLICY "Authenticated users can upload videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'videos');

CREATE POLICY "Authenticated users can delete videos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'videos');

-- ==================================================
-- Restoration Complete!
-- ==================================================
-- Next steps:
-- 1. Copy your new project URL and anon key
-- 2. Update .env.local file with new credentials
-- 3. Restart your Next.js dev server
-- ==================================================
