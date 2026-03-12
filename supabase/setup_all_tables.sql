-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
-- This script sets up ALL tables for CivicResolve AI including the OTP system.

-- 1. Complaints table
CREATE TABLE IF NOT EXISTS complaints (
  id TEXT PRIMARY KEY,
  citizen_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  image TEXT,
  location JSONB NOT NULL,
  employee_location JSONB,
  category TEXT NOT NULL,
  priority TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  assigned_to TEXT,
  ai_analysis JSONB,
  admin_comment TEXT,
  completion_image TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tracking logs table
CREATE TABLE IF NOT EXISTS tracking_logs (
  id BIGSERIAL PRIMARY KEY,
  complaint_id TEXT REFERENCES complaints(id),
  employee_id TEXT NOT NULL,
  coords JSONB NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL
);

-- 3. OTP Store table (CRITICAL for login)
DROP TABLE IF EXISTS public.otp_store;
CREATE TABLE public.otp_store (
  email      text primary key,
  otp        text not null,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_store ENABLE ROW LEVEL SECURITY;

-- Simple RLS Policies (Allows the app to work)
CREATE POLICY "Public full access" ON public.complaints FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access" ON public.tracking_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Manage OTPs" ON public.otp_store FOR ALL USING (true) WITH CHECK (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE complaints;
