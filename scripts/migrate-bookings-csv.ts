/**
 * CSV to Database Migration Script: Booking Data
 *
 * Migrates booking data from CSV file to database:
 * - Creates referrers (if not exist)
 * - Creates examinees
 * - Creates bookings
 * - Creates initial booking progress
 *
 * Prerequisites:
 * - Specialists must already exist in database
 * - DEFAULT_ORGANIZATION_ID must exist
 * - SYSTEM_USER_ID must exist
 * - CSV file with booking data
 *
 * Usage:
 *   # Test mode (import only 1 booking)
 *   TEST_MODE=true tsx scripts/migrate-bookings-csv.ts
 *
 *   # Import all bookings
 *   tsx scripts/migrate-bookings-csv.ts
 */

// Set migration mode flag BEFORE any imports that might use env
process.env.MIGRATION_MODE = "true";

import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import { v4 as uuidv4 } from "uuid";
import * as newSchema from "@/server/db/schema";
import { eq } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";
import { parse } from "csv-parse/sync";

// ============================================================================
// CONFIGURATION
// ============================================================================

const DB_URL = process.env.DATABASE_URL;
const DEFAULT_ORGANIZATION_ID = process.env.DEFAULT_ORGANIZATION_ID;
const SYSTEM_USER_ID = process.env.SYSTEM_USER_ID;
const ACUITY_USER_ID = process.env.ACUITY_USER_ID;
const ACUITY_API_KEY = process.env.ACUITY_API_KEY;

// CSV file path (relative to project root)
const CSV_FILE_PATH = process.env.CSV_FILE_PATH || "./data/bookings-valid.csv";

// Test mode: only migrate one booking for testing
const TEST_MODE = process.env.TEST_MODE === "true";

// Validate-only mode: only validate data, don't import
const VALIDATE_ONLY = process.env.VALIDATE_ONLY === "true";

// Validate environment variables
if (!DB_URL) {
  throw new Error("❌ DATABASE_URL environment variable is required");
}
if (!DEFAULT_ORGANIZATION_ID) {
  throw new Error("❌ DEFAULT_ORGANIZATION_ID environment variable is required");
}
if (!SYSTEM_USER_ID) {
  throw new Error("❌ SYSTEM_USER_ID environment variable is required");
}
if (!ACUITY_USER_ID) {
  throw new Error("❌ ACUITY_USER_ID environment variable is required");
}
if (!ACUITY_API_KEY) {
  throw new Error("❌ ACUITY_API_KEY environment variable is required");
}

if (VALIDATE_ONLY) {
  console.log("🔍 VALIDATE-ONLY MODE - Will check all data without importing\n");
} else if (TEST_MODE) {
  console.log("🧪 TEST MODE ENABLED - Will only import 1 booking and its related data\n");
}

// Database connection
const dbClient: Sql = postgres(DB_URL);
const db = drizzle(dbClient, { schema: newSchema });

// Narrow env types for subsequent use (validated above)
const DEFAULT_ORGANIZATION_ID_STR: string = DEFAULT_ORGANIZATION_ID as string;
const SYSTEM_USER_ID_STR: string = SYSTEM_USER_ID as string;

// ============================================================================
// TYPE DEFINITIONS (CSV ROW)
// ============================================================================

interface CSVBookingRow {
  // Claimant (Examinee) fields
  "Claimant First Name": string;
  "Claimant Last Name": string;
  "Claimant DOB": string;
  "Claimant Phone": string;
  "Claimant Email": string;
  "Claimant Address": string;
  "Contact Authorization": string;
  "Conditions": string;
  "Case Type": string;

  // Referrer fields
  "Referrer First Name": string;
  "Referrer Last Name": string;
  "Referrer Phone": string;
  "Referrer Email": string;
  "Referrer Org": string;

  // Booking fields
  "Specialist name": string;
  "Date": string;
  "Start Time": string;
  "Appointment Type": string;
  "Status": string;
  "Progress": string;
  "Location/Meet URL": string;
  "AAID": string; // Acuity Appointment ID

  // Optional fields (for reference but not used in migration)
  "Documents uploaded?": string;
  "Complex checked?": string;
  "Consent form uploaded?": string;
  "Complex Case": string;
  "Telehealth Device": string;
  "Other Notes": string;
  "Admin Notes": string;
  "Emails released?": string;
  "Document request released?": string;
  "Appointment reminder released?": string;
  "Dictation uploaded?": string;
  "Created at": string;
  "Updated at": string;
  "Documents Upload ID": string;
  "Consent Form ID": string;
  "Dictation Upload ID": string;
  "Document Upload URL": string;
  "Appointment Telehealth URL": string;
  "Appointment Confirmation URL": string;
  "Appointment No show url": string;
  "End Time": string;
  "Today Date": string;
  "Today Hour": string;
  "Days Before Appointment": string;
  "Tracking": string;
  "Referrer Full Name": string;
  "Claimant Full Name": string;
  "ETA": string;
  "Combined date & start time": string;
  "Combined date & end time": string;
  "Specialist email": string;
  "is active": string;
}

// ============================================================================
// ID MAPPING STORAGE
// ============================================================================

const referrerEmailToIdMap = new Map<string, string>();
const specialistEmailToIdMap = new Map<string, string>(); // Email -> Specialist ID
const specialistCalendarIdMap = new Map<string, number>(); // Specialist ID -> Acuity Calendar ID
const examineeIdMap = new Map<string, string>(); // CSV identifier -> DB ID

// Cache for Acuity API responses to avoid duplicate requests
const acuityAppointmentCache = new Map<number, AcuityAppointmentData>();

// API statistics
let acuityApiCalls = 0;
let acuityApiCacheHits = 0;
let acuityApiErrors = 0;

// ============================================================================
// ACUITY API TYPE DEFINITIONS
// ============================================================================

interface AcuityAppointmentData {
  id: number;
  firstName: string;
  lastName: string;
  phone?: string;
  email: string;
  date: string;
  time: string;
  endTime: string;
  datetime: string;
  duration: string;
  type: string;
  appointmentTypeID: number;
  calendarID: number;
  canceled?: boolean;
}

// ============================================================================
// STATISTICS
// ============================================================================

const stats = {
  referrersCreated: 0,
  referrersReused: 0,
  examineesCreated: 0,
  bookingsCreated: 0,
  progressCreated: 0,
  rowsSkipped: 0,
  errors: [] as Array<{ row: number; reason: string; data?: any }>,
};

interface ValidationError {
  row: number;
  field: string;
  issue: string;
  value?: string;
}

const validationErrors: ValidationError[] = [];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse date from various formats
 * Returns null if invalid
 */
function parseDate(value: string | null | undefined): Date | null {
  if (!value || value.trim() === "") return null;

  try {
    const date = new Date(value);
    if (!isNaN(date.getTime())) return date;
    return null;
  } catch {
    return null;
  }
}

/**
 * Parse date in DD/MM/YYYY format (Australian format)
 * Accepts separators: / - .
 * Returns the date as a string in YYYY-MM-DD format for storage
 */
function parseDDMMYYYY(value: string | null | undefined): string | null {
  if (!value || value.trim() === "") return null;

  const trimmed = value.trim();

  // Match DD/MM/YYYY, DD-MM-YYYY, or DD.MM.YYYY formats
  const match = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);

  if (!match) {
    // Try parsing as regular date if not in DD/MM/YYYY format
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return null;
  }

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);

  // Validate ranges
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > 2100) {
    return null;
  }

  // Return in YYYY-MM-DD format
  const dayStr = String(day).padStart(2, '0');
  const monthStr = String(month).padStart(2, '0');

  return `${year}-${monthStr}-${dayStr}`;
}

/**
 * Combine date and time strings into a single Date object
 * Handles formats like "2025-02-01" + "10:00 AM"
 */
function combineDateAndTime(dateStr: string, timeStr: string): Date | null {
  if (!dateStr || !timeStr) return null;

  try {
    // If there's already a combined field, try that first
    const combined = `${dateStr} ${timeStr}`;
    const date = new Date(combined);
    if (!isNaN(date.getTime())) return date;
    return null;
  } catch {
    return null;
  }
}

/**
 * Convert any value to string (handles empty values)
 */
function toString(value: string | null | undefined, defaultValue = ""): string {
  if (value === null || value === undefined || value.trim() === "") {
    return defaultValue;
  }
  return value.trim();
}

/**
 * Parse boolean from string values
 */
function parseBoolean(value: string | null | undefined): boolean {
  if (!value) return false;
  const normalized = value.toLowerCase().trim();
  return normalized === "true" || normalized === "yes" || normalized === "1";
}

/**
 * Validate and normalize email
 * Returns the email if valid, or "n/a" if invalid
 */
function normalizeEmail(value: string | null | undefined): string {
  if (!value || value.trim() === "") {
    return "n/a";
  }

  const trimmed = value.trim();

  // Check if email contains @
  if (!trimmed.includes("@")) {
    return "n/a";
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return "n/a";
  }

  return trimmed;
}

/**
 * Parse integer from string
 */
function parseInteger(value: string | null | undefined, defaultValue = 0): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

// ============================================================================
// ACUITY API FUNCTIONS
// ============================================================================

/**
 * Simple rate limiter - delays execution to respect API rate limits
 * Acuity allows ~10 requests per second
 */
async function rateLimitDelay() {
  await new Promise(resolve => setTimeout(resolve, 120)); // 120ms = ~8 requests/second (safe margin)
}

/**
 * Fetches appointment details from Acuity API
 * Returns cached result if available
 */
async function fetchAcuityAppointment(appointmentId: number): Promise<AcuityAppointmentData | null> {
  // Check cache first
  if (acuityAppointmentCache.has(appointmentId)) {
    acuityApiCacheHits++;
    return acuityAppointmentCache.get(appointmentId)!;
  }

  try {
    // Rate limiting
    await rateLimitDelay();

    acuityApiCalls++;

    const authString = Buffer.from(`${ACUITY_USER_ID}:${ACUITY_API_KEY}`).toString('base64');
    const response = await fetch(
      `https://acuityscheduling.com/api/v1/appointments/${appointmentId}`,
      {
        headers: {
          'Authorization': `Basic ${authString}`,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      acuityApiErrors++;
      console.warn(`   ⚠️  Failed to fetch Acuity appointment ${appointmentId}: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json() as AcuityAppointmentData;

    // Cache the result
    acuityAppointmentCache.set(appointmentId, data);

    return data;
  } catch (error) {
    acuityApiErrors++;
    console.error(`   ❌ Error fetching Acuity appointment ${appointmentId}:`, error);
    return null;
  }
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate a single CSV row
 * Returns true if valid, false if invalid (adds to validationErrors)
 */
function validateRow(row: CSVBookingRow, rowIndex: number): boolean {
  let isValid = true;

  // Helper to add validation error
  const addError = (field: string, issue: string, value?: string) => {
    validationErrors.push({
      row: rowIndex + 1,
      field,
      issue,
      value,
    });
    isValid = false;
  };

  // ===== CLAIMANT (EXAMINEE) VALIDATION =====
  const claimantFirstName = toString(row["Claimant First Name"]);
  const claimantLastName = toString(row["Claimant Last Name"]);
  const claimantDOB = toString(row["Claimant DOB"]);
  const claimantAddress = toString(row["Claimant Address"]);
  const claimantEmail = toString(row["Claimant Email"]);
  const conditions = toString(row["Conditions"]);
  const caseType = toString(row["Case Type"]);
  const contactAuth = toString(row["Contact Authorization"]);

  if (!claimantFirstName) {
    addError("Claimant First Name", "Required field is empty");
  }
  if (!claimantLastName) {
    addError("Claimant Last Name", "Required field is empty");
  }
  if (!claimantDOB) {
    addError("Claimant DOB", "Required field is empty");
  } else if (!parseDDMMYYYY(claimantDOB)) {
    addError("Claimant DOB", "Invalid date format (expected DD/MM/YYYY)", claimantDOB);
  }
  if (!claimantAddress) {
    addError("Claimant Address", "Required field is empty");
  }
  // Note: Claimant Email is optional. Invalid or empty emails will be set to "n/a" during import
  if (!conditions) {
    addError("Conditions", "Required field is empty");
  }
  if (!caseType) {
    addError("Case Type", "Required field is empty");
  }
  if (!contactAuth) {
    addError("Contact Authorization", "Required field is empty");
  }

  // ===== REFERRER VALIDATION =====
  const referrerFirstName = toString(row["Referrer First Name"]);
  const referrerLastName = toString(row["Referrer Last Name"]);
  const referrerEmail = toString(row["Referrer Email"]);

  if (!referrerFirstName) {
    addError("Referrer First Name", "Required field is empty");
  }
  if (!referrerLastName) {
    addError("Referrer Last Name", "Required field is empty");
  }
  if (!referrerEmail) {
    addError("Referrer Email", "Required field is empty");
  } else if (!referrerEmail.includes("@")) {
    addError("Referrer Email", "Invalid email format (must contain @)", referrerEmail);
  }

  // ===== BOOKING VALIDATION =====
  const specialistEmail = toString(row["Specialist email"]);
  const dateStr = toString(row["Date"]);
  const timeStr = toString(row["Start Time"]);
  const aaid = toString(row["AAID"]);

  if (!specialistEmail) {
    addError("Specialist email", "Required field is empty");
  } else if (!specialistEmail.includes("@")) {
    addError("Specialist email", "Invalid email format", specialistEmail);
  } else {
    // Check if specialist exists in our loaded mappings
    const normalizedEmail = specialistEmail.toLowerCase().trim();
    if (!specialistEmailToIdMap.has(normalizedEmail)) {
      addError(
        "Specialist email",
        "Specialist not found in database",
        specialistEmail
      );
    }
  }

  if (!dateStr) {
    addError("Date", "Required field is empty");
  } else if (!parseDate(dateStr)) {
    addError("Date", "Invalid date format", dateStr);
  }

  if (!timeStr) {
    addError("Start Time", "Required field is empty");
  }

  // Try to combine date and time
  if (dateStr && timeStr) {
    const combined = combineDateAndTime(dateStr, timeStr);
    if (!combined && !row["Combined date & start time"]) {
      addError(
        "Date/Start Time",
        "Could not parse combined date and time",
        `${dateStr} ${timeStr}`
      );
    }
  }

  if (!aaid) {
    addError("AAID", "Required field is empty (Acuity Appointment ID)");
  } else {
    const aaidNum = parseInteger(aaid);
    if (aaidNum === 0) {
      addError("AAID", "Invalid number format", aaid);
    }
  }

  return isValid;
}

/**
 * Validate all CSV rows
 * Returns true if all valid, false if any errors found
 */
function validateAllRows(rows: CSVBookingRow[]): boolean {
  console.log("🔍 Validating CSV data...\n");

  const aaidSet = new Set<string>();
  let duplicateAAIDs = 0;

  for (let i = 0; i < rows.length; i++) {
    validateRow(rows[i], i);

    // Check for duplicate AAIDs
    const aaid = toString(rows[i]["AAID"]);
    if (aaid) {
      if (aaidSet.has(aaid)) {
        validationErrors.push({
          row: i + 1,
          field: "AAID",
          issue: "Duplicate AAID found - must be unique",
          value: aaid,
        });
        duplicateAAIDs++;
      }
      aaidSet.add(aaid);
    }
  }

  if (validationErrors.length === 0) {
    console.log("   ✅ All rows validated successfully!");
    console.log(`   - ${rows.length} rows checked`);
    console.log(`   - 0 errors found\n`);
    return true;
  }

  // Group errors by row
  const errorsByRow = new Map<number, ValidationError[]>();
  for (const error of validationErrors) {
    if (!errorsByRow.has(error.row)) {
      errorsByRow.set(error.row, []);
    }
    errorsByRow.get(error.row)!.push(error);
  }

  console.log(`   ❌ Validation failed!`);
  console.log(`   - ${rows.length} rows checked`);
  console.log(`   - ${validationErrors.length} errors found`);
  console.log(`   - ${errorsByRow.size} rows with errors\n`);

  console.log("📋 Validation Errors:\n");

  // Display errors grouped by row
  const rowsToDisplay = Array.from(errorsByRow.keys()).slice(0, 20); // Show first 20 rows with errors

  for (const rowNum of rowsToDisplay) {
    const errors = errorsByRow.get(rowNum)!;
    console.log(`   Row ${rowNum}:`);
    for (const error of errors) {
      if (error.value) {
        console.log(`      ❌ ${error.field}: ${error.issue} (value: "${error.value}")`);
      } else {
        console.log(`      ❌ ${error.field}: ${error.issue}`);
      }
    }
    console.log();
  }

  if (errorsByRow.size > 20) {
    console.log(`   ... and ${errorsByRow.size - 20} more rows with errors\n`);
  }

  // Summary by error type
  const errorsByField = new Map<string, number>();
  for (const error of validationErrors) {
    const count = errorsByField.get(error.field) || 0;
    errorsByField.set(error.field, count + 1);
  }

  console.log("📊 Errors by field:");
  const sortedFields = Array.from(errorsByField.entries()).sort((a, b) => b[1] - a[1]);
  for (const [field, count] of sortedFields) {
    console.log(`   - ${field}: ${count} errors`);
  }
  console.log();

  return false;
}

// ============================================================================
// PREREQUISITE CHECKS
// ============================================================================

async function checkPrerequisites() {
  console.log("🔍 Checking prerequisites...\n");

  try {
    // Check if CSV file exists
    if (!fs.existsSync(CSV_FILE_PATH)) {
      throw new Error(`CSV file not found at path: ${CSV_FILE_PATH}`);
    }
    console.log(`   ✓ CSV file found at ${CSV_FILE_PATH}`);

    // Check if organization exists
    const orgCheck = await dbClient<{ count: string }[]>`
      SELECT COUNT(*) as count FROM organizations WHERE id = ${DEFAULT_ORGANIZATION_ID_STR}
    `;

    if (parseInt(orgCheck[0].count) === 0) {
      throw new Error(
        `Organization with ID ${DEFAULT_ORGANIZATION_ID} does not exist in database`
      );
    }
    console.log(`   ✓ Organization ${DEFAULT_ORGANIZATION_ID} exists`);

    // Check if system user exists
    const userCheck = await dbClient<{ count: string }[]>`
      SELECT COUNT(*) as count FROM users WHERE id = ${SYSTEM_USER_ID_STR}
    `;

    if (parseInt(userCheck[0].count) === 0) {
      throw new Error(`System user with ID ${SYSTEM_USER_ID} does not exist in database`);
    }
    console.log(`   ✓ System user ${SYSTEM_USER_ID} exists`);

    // Check specialists exist
    const specialistsCheck = await dbClient<{ count: string }[]>`
      SELECT COUNT(*) as count FROM specialists
    `;

    const specialistCount = parseInt(specialistsCheck[0].count);
    if (specialistCount === 0) {
      console.warn(
        "   ⚠️  WARNING: No specialists found in database. Bookings will need valid specialist references."
      );
    } else {
      console.log(`   ✓ Found ${specialistCount} specialists in database`);
    }

    console.log();
  } catch (error) {
    console.error("❌ Prerequisites check failed:", error);
    throw error;
  }
}

// ============================================================================
// LOAD SPECIALIST MAPPINGS
// ============================================================================

async function loadSpecialistMappings() {
  console.log("👨‍⚕️ Loading specialist mappings...");

  const specialists = await db.query.specialists.findMany({
    columns: {
      id: true,
      name: true,
      acuityCalendarId: true,
      userId: true,
    },
    with: {
      user: {
        columns: {
          email: true,
        },
      },
    },
  });

  console.log(`   Found ${specialists.length} specialists in database`);

  for (const specialist of specialists) {
    if (specialist.user?.email) {
      // Map by email (normalized)
      const normalizedEmail = specialist.user.email.toLowerCase().trim();
      specialistEmailToIdMap.set(normalizedEmail, specialist.id);
      specialistCalendarIdMap.set(specialist.id, specialist.acuityCalendarId);
    }
  }

  console.log(`   ✓ Loaded ${specialistEmailToIdMap.size} specialist mappings by email`);
  console.log();
}

// ============================================================================
// CSV PARSING
// ============================================================================

function parseCSV(): CSVBookingRow[] {
  console.log("📄 Reading CSV file...");

  const fileContent = fs.readFileSync(CSV_FILE_PATH, "utf-8");

  const records = parse(fileContent, {
    columns: true, // Use first row as column names
    skip_empty_lines: true,
    trim: true,
    bom: true, // Handle BOM in UTF-8 files
  }) as CSVBookingRow[];

  console.log(`   ✓ Parsed ${records.length} rows from CSV`);

  if (TEST_MODE && records.length > 0) {
    console.log(`   🧪 Test mode: Using only the first row`);
    return [records[0]];
  }

  console.log();
  return records;
}

// ============================================================================
// MIGRATION FUNCTIONS
// ============================================================================

/**
 * Get or create referrer
 * Returns referrer ID
 */
async function getOrCreateReferrer(row: CSVBookingRow): Promise<string | null> {
  const email = toString(row["Referrer Email"]);
  const firstName = toString(row["Referrer First Name"]);
  const lastName = toString(row["Referrer Last Name"]);
  const phone = toString(row["Referrer Phone"]);
  const jobTitle = null; // Not available in CSV

  // Validate required fields (email is required for referrers)
  if (!firstName || !lastName || !email) {
    return null; // No referrer data
  }

  // Check if referrer already exists (by email)
  if (referrerEmailToIdMap.has(email)) {
    stats.referrersReused++;
    return referrerEmailToIdMap.get(email)!;
  }

  // Check database for existing referrer by email
  const existing = await db.query.referrers.findFirst({
    where: eq(newSchema.referrers.email, email),
    columns: { id: true },
  });

  if (existing) {
    referrerEmailToIdMap.set(email, existing.id);
    stats.referrersReused++;
    return existing.id;
  }

  // Create new referrer
  const referrerId = uuidv4();

  await db.insert(newSchema.referrers).values({
    id: referrerId,
    organizationId: DEFAULT_ORGANIZATION_ID_STR,
    userId: null, // External referrer
    firstName,
    lastName,
    email, // Valid email required
    phone: phone || "",
    jobTitle: jobTitle || null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  referrerEmailToIdMap.set(email, referrerId);
  stats.referrersCreated++;

  return referrerId;
}

/**
 * Create examinee from CSV row
 * Returns examinee ID
 */
async function createExaminee(row: CSVBookingRow, referrerId: string): Promise<string | null> {
  const firstName = toString(row["Claimant First Name"]);
  const lastName = toString(row["Claimant Last Name"]);
  const dateOfBirthRaw = toString(row["Claimant DOB"]);
  const address = toString(row["Claimant Address"]);
  const emailRaw = toString(row["Claimant Email"]);
  const email = normalizeEmail(emailRaw); // Returns "n/a" if invalid
  const phoneNumber = toString(row["Claimant Phone"]);
  const authorizedContact = parseBoolean(row["Contact Authorization"]);
  const condition = toString(row["Conditions"]);
  const caseType = toString(row["Case Type"]);

  // Parse DOB in DD/MM/YYYY format
  const dateOfBirth = parseDDMMYYYY(dateOfBirthRaw);

  // Validate required fields (from schema - all NOT NULL)
  // Email can be "n/a" so we don't validate it here
  if (!firstName || !lastName || !dateOfBirth || !address || !condition || !caseType) {
    throw new Error(
      `Missing required examinee fields. Required: firstName, lastName, dateOfBirth (DD/MM/YYYY), address, condition, caseType`
    );
  }

  const examineeId = uuidv4();

  await db.insert(newSchema.examinees).values({
    id: examineeId,
    referrerId,
    firstName,
    lastName,
    dateOfBirth, // Now in YYYY-MM-DD format
    address,
    email, // Will be "n/a" if invalid
    phoneNumber: phoneNumber || "",
    authorizedContact,
    condition,
    caseType,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  stats.examineesCreated++;

  return examineeId;
}

/**
 * Create booking from CSV row
 * Returns booking ID
 */
async function createBooking(
  row: CSVBookingRow,
  referrerId: string,
  examineeId: string
): Promise<string | null> {
  const specialistEmail = toString(row["Specialist email"]);
  const appointmentType = toString(row["Appointment Type"]);
  const location = toString(row["Location/Meet URL"]);
  const isActiveStr = toString(row["is active"]);
  const progressStr = toString(row["Progress"]);

  // Combine date and time
  const dateStr = toString(row["Date"]);
  const timeStr = toString(row["Start Time"]);
  const endTimeStr = toString(row["End Time"]);
  let dateTime = combineDateAndTime(dateStr, timeStr);
  let endDateTime: Date | null = null;

  // Fallback to "Combined date & start time" if available
  if (!dateTime && row["Combined date & start time"]) {
    dateTime = parseDate(row["Combined date & start time"]);
  }

  // Try to parse end time for duration calculation
  if (endTimeStr) {
    endDateTime = combineDateAndTime(dateStr, endTimeStr);
    // Fallback to "Combined date & end time" if available
    if (!endDateTime && row["Combined date & end time"]) {
      endDateTime = parseDate(row["Combined date & end time"]);
    }
  }

  // Acuity fields
  const acuityAppointmentId = parseInteger(row["AAID"]);

  // Validate required Acuity fields
  if (!acuityAppointmentId) {
    throw new Error(`Missing required field: AAID (Acuity Appointment ID)`);
  }

  // Fetch appointment details from Acuity API
  const acuityData = await fetchAcuityAppointment(acuityAppointmentId);
  if (!acuityData) {
    throw new Error(`Failed to fetch appointment data from Acuity API for AAID: ${acuityAppointmentId}`);
  }

  // Validate specialist
  if (!specialistEmail) {
    throw new Error(`Missing required field: Specialist email`);
  }

  const specialistId = specialistEmailToIdMap.get(specialistEmail.toLowerCase().trim());
  if (!specialistId) {
    throw new Error(`Specialist not found in database: "${specialistEmail}"`);
  }

  // Use Acuity API data for time, duration, appointmentTypeID, and calendarID
  const acuityDateTime = parseDate(acuityData.datetime);
  if (!acuityDateTime) {
    throw new Error(`Failed to parse datetime from Acuity: ${acuityData.datetime}`);
  }

  const duration = parseInt(acuityData.duration, 10);
  const acuityAppointmentTypeId = acuityData.appointmentTypeID;
  const acuityCalendarId = acuityData.calendarID;

  // Determine booking type from Acuity appointment type field
  const bookingType = acuityData.type?.toLowerCase().includes("telehealth")
    ? "telehealth"
    : "in-person";

  // Map status from "is active" field (Active or Closed)
  let status: "active" | "closed" | "archived" = "active";
  if (isActiveStr) {
    const normalizedStatus = isActiveStr.toLowerCase().trim();
    if (normalizedStatus === "closed") {
      status = "closed";
    } else if (normalizedStatus === "active") {
      status = "active";
    }
  }

  const bookingId = uuidv4();

  await db.insert(newSchema.bookings).values({
    id: bookingId,
    organizationId: DEFAULT_ORGANIZATION_ID_STR,
    teamId: null,
    createdById: SYSTEM_USER_ID_STR,
    referrerId,
    specialistId,
    examineeId,
    status,
    type: bookingType,
    duration,
    location: location || "",
    dateTime: acuityDateTime,
    acuityAppointmentId,
    acuityAppointmentTypeId,
    acuityCalendarId,
    scheduledAt: acuityDateTime,
    completedAt: status === "closed" ? acuityDateTime : null,
    cancelledAt: null, // Not available in CSV
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  stats.bookingsCreated++;

  return bookingId;
}

/**
 * Create initial booking progress
 */
async function createInitialProgress(bookingId: string) {
  await db.insert(newSchema.bookingProgress).values({
    id: uuidv4(),
    bookingId,
    fromStatus: null,
    toStatus: "scheduled",
    changedById: SYSTEM_USER_ID_STR,
    createdAt: new Date(),
  });

  stats.progressCreated++;
}

// ============================================================================
// MAIN MIGRATION ORCHESTRATOR
// ============================================================================

async function processRow(row: CSVBookingRow, rowIndex: number): Promise<boolean> {
  try {
    console.log(`\n📝 Processing row ${rowIndex + 1}...`);

    // Step 1: Get or create referrer
    const referrerId = await getOrCreateReferrer(row);
    if (!referrerId) {
      stats.errors.push({
        row: rowIndex + 1,
        reason: "Missing referrer data",
        data: row,
      });
      stats.rowsSkipped++;
      console.log(`   ❌ Skipped: Missing referrer data`);
      return false;
    }
    console.log(`   ✓ Referrer: ${referrerId}`);

    // Step 2: Create examinee
    const examineeId = await createExaminee(row, referrerId);
    if (!examineeId) {
      stats.errors.push({
        row: rowIndex + 1,
        reason: "Missing examinee data (first_name, last_name required)",
        data: row,
      });
      stats.rowsSkipped++;
      console.log(`   ❌ Skipped: Missing examinee data`);
      return false;
    }
    console.log(`   ✓ Examinee: ${examineeId}`);

    // Step 3: Create booking
    const bookingId = await createBooking(row, referrerId, examineeId);
    if (!bookingId) {
      stats.errors.push({
        row: rowIndex + 1,
        reason: "Failed to create booking",
        data: row,
      });
      stats.rowsSkipped++;
      console.log(`   ❌ Skipped: Failed to create booking`);
      return false;
    }
    console.log(`   ✓ Booking: ${bookingId}`);

    // Step 4: Create initial progress
    await createInitialProgress(bookingId);
    console.log(`   ✓ Progress created`);

    console.log(`   ✅ Row ${rowIndex + 1} processed successfully`);
    return true;
  } catch (error) {
    stats.errors.push({
      row: rowIndex + 1,
      reason: error instanceof Error ? error.message : "Unknown error",
      data: row,
    });
    stats.rowsSkipped++;
    console.error(`   ❌ Error processing row ${rowIndex + 1}:`, error);
    return false;
  }
}

async function runMigration() {
  console.log("🚀 Starting CSV to Database Migration\n");
  console.log("=".repeat(60));
  console.log();

  const startTime = Date.now();

  try {
    // Prerequisites
    await checkPrerequisites();

    // Load specialist mappings
    await loadSpecialistMappings();

    // Parse CSV
    const rows = parseCSV();

    if (rows.length === 0) {
      console.warn("⚠️  No rows found in CSV file");
      return;
    }

    // Show CSV structure (first row keys)
    console.log("📋 CSV Columns detected:");
    console.log("   " + Object.keys(rows[0]).join(", "));
    console.log();

    // VALIDATION PHASE - Check all data before starting migration
    console.log("=".repeat(60));
    const isValid = validateAllRows(rows);
    console.log("=".repeat(60));
    console.log();

    if (!isValid) {
      console.error("❌ Validation failed! Please fix the errors above before importing.");
      console.error("💡 Tip: Fix the CSV file and run the script again.\n");
      process.exit(1);
    }

    // If validate-only mode, exit here
    if (VALIDATE_ONLY) {
      console.log("✅ All data validated successfully!");
      console.log(`📊 ${rows.length} rows are ready to import`);
      console.log("\n💡 To import the data, run without VALIDATE_ONLY=true\n");
      return;
    }

    // Ask for confirmation if not in test mode
    if (!TEST_MODE) {
      console.log("✅ All data validated successfully!");
      console.log(`📊 Ready to import ${rows.length} bookings\n`);
    }

    console.log("⚙️  Starting import...\n");
    console.log("-".repeat(60));

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      await processRow(rows[i], i);
    }

    // Summary
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log("\n" + "=".repeat(60));
    console.log("✅ Migration completed!\n");
    console.log("📊 Migration Summary:");
    console.log(`   - Total rows processed: ${rows.length}`);
    console.log(`   - Referrers created: ${stats.referrersCreated}`);
    console.log(`   - Referrers reused: ${stats.referrersReused}`);
    console.log(`   - Examinees created: ${stats.examineesCreated}`);
    console.log(`   - Bookings created: ${stats.bookingsCreated}`);
    console.log(`   - Progress records created: ${stats.progressCreated}`);
    console.log(`   - Rows skipped: ${stats.rowsSkipped}`);
    console.log(`   - Duration: ${duration} seconds`);
    console.log();
    console.log("🔌 Acuity API Statistics:");
    console.log(`   - API calls made: ${acuityApiCalls}`);
    console.log(`   - Cache hits: ${acuityApiCacheHits}`);
    console.log(`   - API errors: ${acuityApiErrors}`);
    console.log(`   - Total requests: ${acuityApiCalls + acuityApiCacheHits}`);

    if (stats.errors.length > 0) {
      console.log(`\n⚠️  Errors encountered: ${stats.errors.length}`);
      console.log("\nError details:");
      stats.errors.forEach((error) => {
        console.log(`   Row ${error.row}: ${error.reason}`);
      });
    }

    console.log();
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    throw error;
  } finally {
    await dbClient.end();
  }
}

// ============================================================================
// EXECUTE MIGRATION
// ============================================================================

runMigration()
  .then(() => {
    console.log("✨ All done! Your CSV data has been imported.\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Fatal error during migration:", error);
    process.exit(1);
  });
