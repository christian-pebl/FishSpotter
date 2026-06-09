-- Enable row-level security on every table in the `public` schema.
--
-- FishSpotter reaches the database ONLY through Prisma, which connects as the
-- table-owner role and therefore bypasses RLS. Nothing legitimate uses the
-- Supabase anon/authenticated PostgREST path. With RLS off, those public roles
-- (the anon key ships in the browser bundle) could read every table directly —
-- a real exposure of User emails + password hashes and Account OAuth tokens.
-- Enabling RLS with NO policy denies the PostgREST path entirely while leaving
-- the Prisma app untouched.
--
-- This is written as a dynamic loop (not a fixed table list) so any table added
-- later is protected automatically — the regression that a one-off ALTER would
-- miss. Enabling RLS that is already enabled is a no-op, so this is idempotent
-- and safe to re-run. Applied + verified by `npm run db:enable-rls`.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE '\_prisma\_%'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
  END LOOP;
END $$;
