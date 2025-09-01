-- Drop redundant accepts_in_person and accepts_telehealth columns
-- These values are now computed from the enabled appointment types
ALTER TABLE specialists 
DROP COLUMN IF EXISTS accepts_in_person,
DROP COLUMN IF EXISTS accepts_telehealth;