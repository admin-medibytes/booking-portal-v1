-- Create initial admin user for testing
-- Run this after database migrations

-- Create organization
INSERT INTO organizations (id, name, slug, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'Medibytes Admin Organization',
  'medibytes-admin',
  NOW(),
  NOW()
) RETURNING id INTO @org_id;

-- Create admin user
-- Password is 'Admin123!@#' hashed with argon2
-- NOTE: You should generate a proper hash using the auth system
INSERT INTO users (
  id, 
  email, 
  name,
  first_name,
  last_name,
  job_title,
  email_verified,
  role,
  created_at,
  updated_at
)
VALUES (
  gen_random_uuid(),
  'admin@medibytes.com',
  'System Admin',
  'System',
  'Admin',
  'Administrator',
  true,
  'admin',
  NOW(),
  NOW()
) RETURNING id;

-- Note: You'll need to use the auth system to properly create the user with password
-- This SQL is just for reference of the structure