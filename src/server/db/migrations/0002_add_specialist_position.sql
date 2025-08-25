-- Add position column to specialists table
ALTER TABLE specialists 
ADD COLUMN position INTEGER;

-- Set initial positions based on creation order
WITH ranked_specialists AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as rn
  FROM specialists
)
UPDATE specialists s
SET position = rs.rn
FROM ranked_specialists rs
WHERE s.id = rs.id;

-- Make position NOT NULL after setting values
ALTER TABLE specialists 
ALTER COLUMN position SET NOT NULL;

-- Create index for efficient sorting
CREATE INDEX specialists_position_idx ON specialists(position);

-- Add unique constraint to prevent duplicates
ALTER TABLE specialists 
ADD CONSTRAINT unique_specialist_position UNIQUE (position);

-- Drop the specialty column as we'll use jobTitle from users table
ALTER TABLE specialists 
DROP COLUMN specialty;