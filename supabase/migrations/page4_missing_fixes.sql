-- ============================================================
-- CivicResolve AI — PAGE 4 (Add Missing Pieces Only)
-- Run this in a NEW Supabase SQL Editor tab
-- Pages 1-3 already exist — this adds ONLY what's missing
-- ============================================================

-- ─── 1. Create users table (MISSING — needed for login) ──────
CREATE TABLE IF NOT EXISTS public.users (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'CITIZEN',
  lang_preference TEXT DEFAULT 'en',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS + policy
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Public full access'
  ) THEN
    CREATE POLICY "Public full access" ON public.users FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ─── 2. Add citizen_email to complaints (MISSING — needed for My Complaints filter) ───
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'complaints'
      AND column_name  = 'citizen_email'
  ) THEN
    ALTER TABLE public.complaints ADD COLUMN citizen_email TEXT;
    RAISE NOTICE 'citizen_email column added to complaints.';
  ELSE
    RAISE NOTICE 'citizen_email column already exists — skipped.';
  END IF;
END $$;

-- ─── Done! ────────────────────────────────────────────────────
-- Your existing tables are correct.
-- These 2 additions fix:
--   (a) user sessions being saved to DB after login
--   (b) "My Complaints" showing nothing for citizens
