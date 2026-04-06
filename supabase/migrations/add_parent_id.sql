-- Add parent_id column to complaints table for grouping duplicate reports under a master incident
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS parent_id TEXT;
