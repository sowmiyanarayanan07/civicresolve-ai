-- Add resolved_at to complaints table
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS resolved_at timestamp with time zone;
