-- ============================================================
-- CivicResolve AI — App Settings Table (for real-time Crisis Mode)
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

CREATE TABLE IF NOT EXISTS public.app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Enable RLS + open policy (admin-controlled via app logic)
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'app_settings' AND policyname = 'Public full access'
  ) THEN
    CREATE POLICY "Public full access" ON public.app_settings FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Enable Realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;

-- Seed the crisis_mode row (starts OFF)
INSERT INTO public.app_settings (key, value)
VALUES ('crisis_mode', 'false')
ON CONFLICT (key) DO NOTHING;
