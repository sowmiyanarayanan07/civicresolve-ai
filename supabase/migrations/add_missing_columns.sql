-- ============================================================
-- CivicResolve AI — Add ALL Missing Columns to complaints
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ─── 1. ai_verification (needed for complaint submission) ────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'complaints'
      AND column_name  = 'ai_verification'
  ) THEN
    ALTER TABLE public.complaints ADD COLUMN ai_verification jsonb;
    RAISE NOTICE 'ai_verification column added.';
  ELSE
    RAISE NOTICE 'ai_verification column already exists — skipped.';
  END IF;
END $$;

-- ─── 2. parent_id (needed for Smart Duplicate Grouping) ──────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'complaints'
      AND column_name  = 'parent_id'
  ) THEN
    ALTER TABLE public.complaints ADD COLUMN parent_id TEXT;
    RAISE NOTICE 'parent_id column added.';
  ELSE
    RAISE NOTICE 'parent_id column already exists — skipped.';
  END IF;
END $$;

-- ─── 3. citizen_email (needed for My Complaints filter) ──────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'complaints'
      AND column_name  = 'citizen_email'
  ) THEN
    ALTER TABLE public.complaints ADD COLUMN citizen_email TEXT;
    RAISE NOTICE 'citizen_email column added.';
  ELSE
    RAISE NOTICE 'citizen_email column already exists — skipped.';
  END IF;
END $$;

-- ─── Done! ───────────────────────────────────────────────────
-- These columns fix:
--   (a) Complaint submit crashing → ai_verification
--   (b) Smart Duplicate Grouping → parent_id
--   (c) My Complaints empty for citizens → citizen_email
