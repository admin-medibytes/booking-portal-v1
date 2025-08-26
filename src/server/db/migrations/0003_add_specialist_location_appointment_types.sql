-- Add appointment type fields
ALTER TABLE specialists 
ADD COLUMN accepts_in_person BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN accepts_telehealth BOOLEAN DEFAULT TRUE NOT NULL;

-- Convert location to JSONB
ALTER TABLE specialists 
ALTER COLUMN location TYPE JSONB USING 
  CASE 
    WHEN location IS NOT NULL THEN 
      json_build_object('city', location, 'state', 'QLD', 'country', 'Australia')
    ELSE NULL
  END;

-- Add check constraint for at least one appointment type
ALTER TABLE specialists
ADD CONSTRAINT at_least_one_appointment_type CHECK (
  accepts_in_person = TRUE OR accepts_telehealth = TRUE
);

-- Add check constraint for location consistency
ALTER TABLE specialists
ADD CONSTRAINT location_required_fields CHECK (
  location IS NULL OR (
    location->>'city' IS NOT NULL AND
    location->>'state' IS NOT NULL AND
    location->>'country' IS NOT NULL
  )
);

-- Add indexes for location search
CREATE INDEX specialists_location_city_idx ON specialists ((location->>'city'));
CREATE INDEX specialists_location_state_idx ON specialists ((location->>'state'));