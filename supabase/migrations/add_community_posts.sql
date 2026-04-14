-- ============================================================
-- CivicResolve AI — Community Posts Table
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

CREATE TABLE IF NOT EXISTS public.community_posts (
  id            TEXT PRIMARY KEY,
  author_id     TEXT NOT NULL,
  author_name   TEXT NOT NULL,
  author_role   TEXT NOT NULL,
  author_avatar TEXT,
  content       TEXT NOT NULL,
  image         TEXT,
  tag           TEXT NOT NULL,
  likes         JSONB DEFAULT '[]'::jsonb,
  comments      JSONB DEFAULT '[]'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;

-- Allow all logged-in users to read/write/update
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'community_posts' AND policyname = 'Public access'
  ) THEN
    CREATE POLICY "Public access" ON public.community_posts FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_posts;
