-- Add slug column to specialists table
ALTER TABLE specialists ADD COLUMN slug TEXT;

-- Make slug unique after populating it
ALTER TABLE specialists ADD CONSTRAINT specialists_slug_unique UNIQUE (slug);

-- Create index for slug lookups
CREATE INDEX specialists_slug_idx ON specialists (slug);

-- Set NOT NULL constraint (requires data migration first)
-- This will be done after populating existing records
ALTER TABLE specialists ALTER COLUMN slug SET NOT NULL;