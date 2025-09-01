-- Add appointment_mode column to specialist_appointment_types table
-- This column specifies whether the appointment type is available for in-person or telehealth

-- Create enum type for appointment modes
DO $$ BEGIN
    CREATE TYPE appointment_mode AS ENUM ('in-person', 'telehealth');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add appointment_mode column (required field, no default)
ALTER TABLE specialist_appointment_types 
ADD COLUMN IF NOT EXISTS appointment_mode text NOT NULL;

-- Add constraint to ensure valid values
ALTER TABLE specialist_appointment_types
ADD CONSTRAINT specialist_appointment_types_appointment_mode_check 
CHECK (appointment_mode IN ('in-person', 'telehealth'));

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS specialist_appointment_types_appointment_mode_idx 
ON specialist_appointment_types(appointment_mode);