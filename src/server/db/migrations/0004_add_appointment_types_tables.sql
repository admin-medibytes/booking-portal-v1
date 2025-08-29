-- Create appointment_types table
CREATE TABLE IF NOT EXISTS appointment_types (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  acuity_appointment_type_id INTEGER NOT NULL UNIQUE,
  acuity_name TEXT NOT NULL,
  acuity_description TEXT,
  duration_minutes INTEGER NOT NULL,
  category TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_synced_at TIMESTAMP,
  raw JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for appointment_types
CREATE INDEX appointment_types_acuity_id_idx ON appointment_types (acuity_appointment_type_id);
CREATE INDEX appointment_types_active_idx ON appointment_types (active);
CREATE INDEX appointment_types_category_idx ON appointment_types (category);

-- Create specialist_appointment_types junction table
CREATE TABLE IF NOT EXISTS specialist_appointment_types (
  specialist_id TEXT NOT NULL REFERENCES specialists(id) ON DELETE CASCADE,
  appointment_type_id TEXT NOT NULL REFERENCES appointment_types(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  custom_display_name TEXT,
  custom_description TEXT,
  custom_price INTEGER,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT specialist_appointment_types_pk UNIQUE (specialist_id, appointment_type_id)
);

-- Create indexes for specialist_appointment_types
CREATE INDEX specialist_appointment_types_specialist_id_idx ON specialist_appointment_types (specialist_id);
CREATE INDEX specialist_appointment_types_appointment_type_id_idx ON specialist_appointment_types (appointment_type_id);
CREATE INDEX specialist_appointment_types_enabled_idx ON specialist_appointment_types (enabled);

-- Add updated_at trigger for appointment_types
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_appointment_types_updated_at BEFORE UPDATE ON appointment_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_specialist_appointment_types_updated_at BEFORE UPDATE ON specialist_appointment_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();