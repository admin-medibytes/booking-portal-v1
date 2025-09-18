-- Add examinee field mapping to app_form_fields table
ALTER TABLE "app_form_fields" 
ADD COLUMN "examinee_field_mapping" VARCHAR(50) DEFAULT NULL;

-- Add index for faster queries when extracting examinee data
CREATE INDEX "idx_app_form_fields_examinee_mapping" 
ON "app_form_fields" ("app_form_id", "examinee_field_mapping") 
WHERE "examinee_field_mapping" IS NOT NULL;

-- Add comment to describe the column
COMMENT ON COLUMN "app_form_fields"."examinee_field_mapping" IS 'Maps this form field to a specific examinee data field (firstName, lastName, dateOfBirth, etc.)';