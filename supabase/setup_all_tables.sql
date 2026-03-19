-- ============================================================
-- CivicResolve AI — Full Database Setup
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql/new
-- ============================================================

-- ─── 1. Users table (stores all logged-in users) ────────────
CREATE TABLE IF NOT EXISTS public.users (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'CITIZEN',
  lang_preference TEXT DEFAULT 'en',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 2. Admins table (allowlist for admin login) ─────────────
-- Add rows here for each admin email you want to authorize.
CREATE TABLE IF NOT EXISTS public.admins (
  email       TEXT PRIMARY KEY,
  name        TEXT NOT NULL DEFAULT 'Admin',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 3. Employees table ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.employees (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  name                TEXT NOT NULL,
  email               TEXT UNIQUE NOT NULL,
  department          TEXT NOT NULL,
  phone               TEXT,
  availability_status TEXT NOT NULL DEFAULT 'Available',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 4. Complaints table ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.complaints (
  id               TEXT PRIMARY KEY,
  citizen_id       TEXT NOT NULL,
  citizen_email    TEXT,                        -- ← added: used to filter "My Complaints"
  title            TEXT NOT NULL,
  description      TEXT NOT NULL,
  image            TEXT,
  location         JSONB NOT NULL,
  employee_location JSONB,
  category         TEXT NOT NULL,
  priority         TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'Submitted',
  assigned_to      TEXT,
  ai_analysis      JSONB,
  admin_comment    TEXT,
  completion_image TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 5. Tracking logs table ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tracking_logs (
  id           BIGSERIAL PRIMARY KEY,
  complaint_id TEXT REFERENCES public.complaints(id) ON DELETE CASCADE,
  employee_id  TEXT NOT NULL,
  coords       JSONB NOT NULL,
  timestamp    TIMESTAMPTZ NOT NULL
);

-- ─── 6. OTP Store table ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.otp_store (
  email      TEXT PRIMARY KEY,
  otp        TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Enable Row Level Security ───────────────────────────────
ALTER TABLE public.users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_logs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_store       ENABLE ROW LEVEL SECURITY;

-- ─── RLS Policies (open access for anon key, app controls logic) ─
DO $$
BEGIN
  -- users
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='users' AND policyname='Public full access') THEN
    CREATE POLICY "Public full access" ON public.users FOR ALL USING (true) WITH CHECK (true);
  END IF;
  -- admins
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='admins' AND policyname='Public full access') THEN
    CREATE POLICY "Public full access" ON public.admins FOR ALL USING (true) WITH CHECK (true);
  END IF;
  -- employees
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='employees' AND policyname='Public full access') THEN
    CREATE POLICY "Public full access" ON public.employees FOR ALL USING (true) WITH CHECK (true);
  END IF;
  -- complaints
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='complaints' AND policyname='Public full access') THEN
    CREATE POLICY "Public full access" ON public.complaints FOR ALL USING (true) WITH CHECK (true);
  END IF;
  -- tracking_logs
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tracking_logs' AND policyname='Public full access') THEN
    CREATE POLICY "Public full access" ON public.tracking_logs FOR ALL USING (true) WITH CHECK (true);
  END IF;
  -- otp_store
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='otp_store' AND policyname='Manage OTPs') THEN
    CREATE POLICY "Manage OTPs" ON public.otp_store FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ─── Enable Realtime for complaints ──────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.complaints;

-- ─── Add citizen_email column to existing complaints if missing ─
-- (Safe to run even if column already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'complaints' AND column_name = 'citizen_email'
  ) THEN
    ALTER TABLE public.complaints ADD COLUMN citizen_email TEXT;
  END IF;
END $$;

-- ─── SEED: Insert your admin email here ──────────────────────
-- IMPORTANT: Replace with your actual admin email address!
-- INSERT INTO public.admins (email, name) VALUES ('your-admin@email.com', 'Admin Name')
-- ON CONFLICT (email) DO NOTHING;
