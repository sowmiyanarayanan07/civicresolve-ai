-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
-- Creates the otp_store table used by the Vercel API for shared OTP state

create table if not exists public.otp_store (
  email      text primary key,
  otp        text not null,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

-- Allow the anon key (used by the serverless function) to read/write
alter table public.otp_store enable row level security;

create policy "Service can manage OTPs"
  on public.otp_store
  for all
  using (true)
  with check (true);

-- Auto-delete expired OTPs (optional cleanup)
create index if not exists otp_store_expires_at_idx on public.otp_store(expires_at);
