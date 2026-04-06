-- Add ai_verification column to complaints table
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS ai_verification jsonb;
