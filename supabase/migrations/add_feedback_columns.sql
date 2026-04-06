-- Add feedback rating and comments to complaints table
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS feedback_rating int;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS feedback_comments text;
