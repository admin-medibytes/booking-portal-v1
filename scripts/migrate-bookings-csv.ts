/**
 * Acuity to Database Migration Script: Booking Data
 *
 * Migrates booking data from Acuity API to database, using CSV for additional data:
 * - Fetches appointments from Acuity for a specific date range
 * - Looks up additional data in CSV file by AAID
 * - Creates referrers (always new)
 * - Creates examinees
 * - Creates bookings
 * - Creates initial booking progress
 * - All operations are wrapped in a transaction (all succeed or all fail)
 *
 * Prerequisites:
 * - Specialists must already exist in database
 * - DEFAULT_ORGANIZATION_ID must exist
 * - SYSTEM_USER_ID must exist
 * - CSV file with booking data (for lookup)
 * - Acuity API credentials
 *
 * Usage:
 *   # Interactive mode (will prompt for dates)
 *   tsx scripts/migrate-bookings-csv.ts
 *
 *   # With environment variables
 *   START_DATE=2025-10-01 END_DATE=2025-10-31 tsx scripts/migrate-bookings-csv.ts
 *
 *   # Test mode (import only 1 booking)
 *   TEST_MODE=true START_DATE=2025-10-01 END_DATE=2025-10-31 tsx scripts/migrate-bookings-csv.ts
 */

// Set migration mode flag BEFORE any imports that might use env
process.env.MIGRATION_MODE = "true";

import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import { v4 as uuidv4 } from "uuid";
import * as newSchema from "@/server/db/schema";
import { eq, sql } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";
import { parse } from "csv-parse/sync";
import * as readline from "readline";

// ============================================================================
// CONFIGURATION
// ============================================================================

const DB_URL = process.env.DATABASE_URL;
const DEFAULT_ORGANIZATION_ID = process.env.DEFAULT_ORGANIZATION_ID;
const SYSTEM_USER_ID = process.env.SYSTEM_USER_ID;
const ACUITY_USER_ID = process.env.ACUITY_USER_ID;
const ACUITY_API_KEY = process.env.ACUITY_API_KEY;

// CSV file path (relative to project root) - used for lookup only
const CSV_FILE_PATH = process.env.CSV_FILE_PATH || "./data/bookings.csv";

// Date range to fetch appointments from Acuity (format: YYYY-MM-DD)
const START_DATE = process.env.START_DATE;
const END_DATE = process.env.END_DATE;

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

const specialistEmailToIdMap = new Map<string, string>(); // Email -> Specialist ID
const specialistCalendarIdMap = new Map<string, number>(); // Specialist ID -> Acuity Calendar ID
const specialistCalendarToIdMap = new Map<number, string>(); // Acuity Calendar ID -> Specialist ID

// CSV lookup by AAID
const csvDataByAAID = new Map<number, CSVBookingRow>();

// API statistics
let acuityApiCalls = 0;
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
  examineesCreated: 0,
  bookingsCreated: 0,
  progressCreated: 0,
  appointmentsSkipped: 0,
  bookingsAlreadyExist: 0,
  appointmentsWithoutCSVData: 0,
  skippedAppointments: [] as Array<{ appointmentId: number; reason: string }>,
  errors: [] as Array<{ appointmentId: number; reason: string; data?: any }>,
};

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
// USER INPUT FUNCTIONS
// ============================================================================

/**
 * Prompt user for date range input
 * Returns { startDate, endDate } in YYYY-MM-DD format
 */
async function promptForDateRange(): Promise<{ startDate: string; endDate: string }> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('Start date (YYYY-MM-DD): ', (startAnswer) => {
      const startDate = startAnswer.trim();

      // Validate start date format
      const startMatch = startDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!startMatch) {
        console.error(`\n❌ Invalid start date format: "${startDate}". Expected format: YYYY-MM-DD (e.g., 2025-10-01)\n`);
        rl.close();
        process.exit(1);
      }

      const startYear = parseInt(startMatch[1]);
      const startMonth = parseInt(startMatch[2]);
      const startDay = parseInt(startMatch[3]);

      if (startYear < 2000 || startYear > 2100) {
        console.error(`\n❌ Invalid year: ${startYear}. Must be between 2000 and 2100\n`);
        rl.close();
        process.exit(1);
      }

      if (startMonth < 1 || startMonth > 12) {
        console.error(`\n❌ Invalid month: ${startMonth}. Must be between 01 and 12\n`);
        rl.close();
        process.exit(1);
      }

      if (startDay < 1 || startDay > 31) {
        console.error(`\n❌ Invalid day: ${startDay}. Must be between 01 and 31\n`);
        rl.close();
        process.exit(1);
      }

      // Ask for end date
      rl.question('End date (YYYY-MM-DD): ', (endAnswer) => {
        rl.close();
        const endDate = endAnswer.trim();

        // Validate end date format
        const endMatch = endDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!endMatch) {
          console.error(`\n❌ Invalid end date format: "${endDate}". Expected format: YYYY-MM-DD (e.g., 2025-10-31)\n`);
          process.exit(1);
        }

        const endYear = parseInt(endMatch[1]);
        const endMonth = parseInt(endMatch[2]);
        const endDay = parseInt(endMatch[3]);

        if (endYear < 2000 || endYear > 2100) {
          console.error(`\n❌ Invalid year: ${endYear}. Must be between 2000 and 2100\n`);
          process.exit(1);
        }

        if (endMonth < 1 || endMonth > 12) {
          console.error(`\n❌ Invalid month: ${endMonth}. Must be between 01 and 12\n`);
          process.exit(1);
        }

        if (endDay < 1 || endDay > 31) {
          console.error(`\n❌ Invalid day: ${endDay}. Must be between 01 and 31\n`);
          process.exit(1);
        }

        // Validate that end date is after start date
        const startDateObj = new Date(startDate);
        const endDateObj = new Date(endDate);

        if (endDateObj < startDateObj) {
          console.error(`\n❌ End date (${endDate}) must be after or equal to start date (${startDate})\n`);
          process.exit(1);
        }

        resolve({ startDate, endDate });
      });
    });
  });
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
 * Fetches all appointments for a specific date range from Acuity API
 * Returns array of appointments
 */
async function fetchAcuityAppointmentsForDateRange(startDate: string, endDate: string): Promise<AcuityAppointmentData[]> {
  try {
    const max = '1000';
    const showall = 'true';

    console.log(`   📅 Fetching appointments from ${startDate} to ${endDate}...`);

    // Rate limiting
    await rateLimitDelay();

    acuityApiCalls++;

    const authString = Buffer.from(`${ACUITY_USER_ID}:${ACUITY_API_KEY}`).toString('base64');
    const url = new URL('https://acuityscheduling.com/api/v1/appointments');
    url.searchParams.append('minDate', startDate);
    url.searchParams.append('maxDate', endDate);
    url.searchParams.append('max', max);
    url.searchParams.append('showall', showall);

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Basic ${authString}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      acuityApiErrors++;
      throw new Error(`Failed to fetch Acuity appointments: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as AcuityAppointmentData[];

    console.log(`   ✓ Fetched ${data.length} appointments from Acuity`);

    return data;
  } catch (error) {
    acuityApiErrors++;
    console.error(`   ❌ Error fetching Acuity appointments:`, error);
    throw error;
  }
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
    // Map by Acuity Calendar ID (for reverse lookup)
    specialistCalendarToIdMap.set(specialist.acuityCalendarId, specialist.id);
  }

  console.log(`   ✓ Loaded ${specialistEmailToIdMap.size} specialist mappings by email`);
  console.log(`   ✓ Loaded ${specialistCalendarToIdMap.size} specialist mappings by calendar ID`);
  console.log();
}

// ============================================================================
// CSV PARSING AND INDEXING
// ============================================================================

function parseAndIndexCSV(): void {
  console.log("📄 Reading and indexing CSV file...");

  const fileContent = fs.readFileSync(CSV_FILE_PATH, "utf-8");

  const records = parse(fileContent, {
    columns: true, // Use first row as column names
    skip_empty_lines: true,
    trim: true,
    bom: true, // Handle BOM in UTF-8 files
  }) as CSVBookingRow[];

  console.log(`   ✓ Parsed ${records.length} rows from CSV`);

  // Index by AAID for fast lookup
  let indexed = 0;
  for (const row of records) {
    const aaid = parseInteger(row["AAID"]);
    if (aaid && aaid > 0) {
      csvDataByAAID.set(aaid, row);
      indexed++;
    }
  }

  console.log(`   ✓ Indexed ${indexed} rows by AAID`);
  console.log();
}

/**
 * Find CSV data by Acuity Appointment ID
 */
function findCSVDataByAAID(aaid: number): CSVBookingRow | null {
  return csvDataByAAID.get(aaid) || null;
}

// ============================================================================
// MIGRATION FUNCTIONS
// ============================================================================

/**
 * Create referrer from CSV row within a transaction
 * Always creates a new referrer for each booking
 * Returns { id: string, error?: string } - error contains details of missing fields if validation fails
 */
async function createReferrerInTransaction(tx: any, csvRow: CSVBookingRow): Promise<{ id: string | null; error?: string }> {
  const email = toString(csvRow["Referrer Email"]);
  const firstName = toString(csvRow["Referrer First Name"]);
  const lastName = toString(csvRow["Referrer Last Name"]);
  const phone = toString(csvRow["Referrer Phone"]);
  const jobTitle = null; // Not available in CSV

  // Validate required fields and collect missing fields
  const missingFields: string[] = [];
  if (!firstName) missingFields.push("Referrer First Name");
  if (!lastName) missingFields.push("Referrer Last Name");
  if (!email) missingFields.push("Referrer Email");

  if (missingFields.length > 0) {
    return {
      id: null,
      error: `Missing required fields: ${missingFields.join(", ")}`,
    };
  }

  // At this point, all required fields are guaranteed to be non-empty strings
  // Always create new referrer for each booking
  const referrerId = uuidv4();

  await tx.insert(newSchema.referrers).values({
    id: referrerId,
    organizationId: DEFAULT_ORGANIZATION_ID_STR,
    userId: null, // External referrer
    firstName: firstName!, // Non-null assertion since we validated above
    lastName: lastName!,
    email: email!,
    phone: phone || "",
    jobTitle: jobTitle || null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  stats.referrersCreated++;

  return { id: referrerId };
}

/**
 * Create referrer from CSV row (CSV data is required for referrer)
 * Always creates a new referrer for each booking
 * Returns { id: string, error?: string } - error contains details of missing fields if validation fails
 * @deprecated Use createReferrerInTransaction instead
 */
async function createReferrer(csvRow: CSVBookingRow): Promise<{ id: string | null; error?: string }> {
  const email = toString(csvRow["Referrer Email"]);
  const firstName = toString(csvRow["Referrer First Name"]);
  const lastName = toString(csvRow["Referrer Last Name"]);
  const phone = toString(csvRow["Referrer Phone"]);
  const jobTitle = null; // Not available in CSV

  // Validate required fields and collect missing fields
  const missingFields: string[] = [];
  if (!firstName) missingFields.push("Referrer First Name");
  if (!lastName) missingFields.push("Referrer Last Name");
  if (!email) missingFields.push("Referrer Email");

  if (missingFields.length > 0) {
    return {
      id: null,
      error: `Missing required fields: ${missingFields.join(", ")}`,
    };
  }

  // At this point, all required fields are guaranteed to be non-empty strings
  // Always create new referrer for each booking
  const referrerId = uuidv4();

  await db.insert(newSchema.referrers).values({
    id: referrerId,
    organizationId: DEFAULT_ORGANIZATION_ID_STR,
    userId: null, // External referrer
    firstName: firstName!, // Non-null assertion since we validated above
    lastName: lastName!,
    email: email!,
    phone: phone || "",
    jobTitle: jobTitle || null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  stats.referrersCreated++;

  return { id: referrerId };
}

/**
 * Create examinee from CSV row within a transaction
 * Returns { id: string, error?: string } - error contains details of missing fields if validation fails
 */
async function createExamineeInTransaction(tx: any, csvRow: CSVBookingRow, referrerId: string): Promise<{ id: string | null; error?: string }> {
  const firstName = toString(csvRow["Claimant First Name"]);
  const lastName = toString(csvRow["Claimant Last Name"]);
  const dateOfBirthRaw = toString(csvRow["Claimant DOB"]);
  const address = toString(csvRow["Claimant Address"]);
  const emailRaw = toString(csvRow["Claimant Email"]);
  const email = normalizeEmail(emailRaw); // Returns "n/a" if invalid
  const phoneNumber = toString(csvRow["Claimant Phone"]);
  const authorizedContact = parseBoolean(csvRow["Contact Authorization"]);
  const condition = toString(csvRow["Conditions"]);
  const caseType = toString(csvRow["Case Type"]);

  // Parse DOB in DD/MM/YYYY format
  const dateOfBirth = parseDDMMYYYY(dateOfBirthRaw);

  // Validate required fields and collect missing/invalid fields
  const missingFields: string[] = [];
  if (!firstName) missingFields.push("Claimant First Name");
  if (!lastName) missingFields.push("Claimant Last Name");
  if (!dateOfBirthRaw) {
    // Only check if the raw value exists, not if it's parseable
    missingFields.push("Claimant DOB");
  }
  if (!address) missingFields.push("Claimant Address");
  if (!condition) missingFields.push("Conditions");
  if (!caseType) missingFields.push("Case Type");

  if (missingFields.length > 0) {
    return {
      id: null,
      error: `Missing required fields: ${missingFields.join(", ")}`,
    };
  }

  // At this point, all required fields are guaranteed to be non-empty strings
  const examineeId = uuidv4();

  await tx.insert(newSchema.examinees).values({
    id: examineeId,
    referrerId,
    firstName: firstName!, // Non-null assertion since we validated above
    lastName: lastName!,
    dateOfBirth: dateOfBirth || dateOfBirthRaw!, // Use parsed date if available, otherwise raw value
    address: address!,
    email, // Will be "n/a" if invalid
    phoneNumber: phoneNumber || "",
    authorizedContact,
    condition: condition!,
    caseType: caseType!,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  stats.examineesCreated++;

  return { id: examineeId };
}

/**
 * Create examinee from CSV row (CSV data is required for examinee)
 * Returns { id: string, error?: string } - error contains details of missing fields if validation fails
 * @deprecated Use createExamineeInTransaction instead
 */
async function createExaminee(csvRow: CSVBookingRow, referrerId: string): Promise<{ id: string | null; error?: string }> {
  const firstName = toString(csvRow["Claimant First Name"]);
  const lastName = toString(csvRow["Claimant Last Name"]);
  const dateOfBirthRaw = toString(csvRow["Claimant DOB"]);
  const address = toString(csvRow["Claimant Address"]);
  const emailRaw = toString(csvRow["Claimant Email"]);
  const email = normalizeEmail(emailRaw); // Returns "n/a" if invalid
  const phoneNumber = toString(csvRow["Claimant Phone"]);
  const authorizedContact = parseBoolean(csvRow["Contact Authorization"]);
  const condition = toString(csvRow["Conditions"]);
  const caseType = toString(csvRow["Case Type"]);

  // Parse DOB in DD/MM/YYYY format
  const dateOfBirth = parseDDMMYYYY(dateOfBirthRaw);

  // Validate required fields and collect missing/invalid fields
  const missingFields: string[] = [];
  if (!firstName) missingFields.push("Claimant First Name");
  if (!lastName) missingFields.push("Claimant Last Name");
  if (!dateOfBirthRaw) {
    // Only check if the raw value exists, not if it's parseable
    missingFields.push("Claimant DOB");
  }
  if (!address) missingFields.push("Claimant Address");
  if (!condition) missingFields.push("Conditions");
  if (!caseType) missingFields.push("Case Type");

  if (missingFields.length > 0) {
    return {
      id: null,
      error: `Missing required fields: ${missingFields.join(", ")}`,
    };
  }

  // At this point, all required fields are guaranteed to be non-empty strings
  const examineeId = uuidv4();

  await db.insert(newSchema.examinees).values({
    id: examineeId,
    referrerId,
    firstName: firstName!, // Non-null assertion since we validated above
    lastName: lastName!,
    dateOfBirth: dateOfBirth!, // Non-null assertion since we validated above
    address: address!,
    email, // Will be "n/a" if invalid
    phoneNumber: phoneNumber || "",
    authorizedContact,
    condition: condition!,
    caseType: caseType!,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  stats.examineesCreated++;

  return { id: examineeId };
}

/**
 * Create booking from Acuity data with CSV fallback within a transaction
 * Returns booking ID
 */
async function createBookingInTransaction(
  tx: any,
  acuityData: AcuityAppointmentData,
  csvRow: CSVBookingRow | null,
  referrerId: string,
  examineeId: string
): Promise<string | null> {
  // Primary data source: Acuity
  const acuityAppointmentId = acuityData.id;
  const acuityAppointmentTypeId = acuityData.appointmentTypeID;
  const acuityCalendarId = acuityData.calendarID;
  const duration = parseInt(acuityData.duration, 10);

  // Parse datetime from Acuity
  const acuityDateTime = parseDate(acuityData.datetime);
  if (!acuityDateTime) {
    throw new Error(`Failed to parse datetime from Acuity: ${acuityData.datetime}`);
  }

  // Determine booking type from Acuity appointment type field
  const bookingType = acuityData.type?.toLowerCase().includes("telehealth")
    ? "telehealth"
    : "in-person";

  // Get specialist by calendar ID
  const specialistId = specialistCalendarToIdMap.get(acuityCalendarId);
  if (!specialistId) {
    throw new Error(`Specialist not found for Acuity calendar ID: ${acuityCalendarId}`);
  }

  // Get location from CSV if available, otherwise empty
  const location = csvRow ? toString(csvRow["Location/Meet URL"]) : "";

  // Map status from CSV "is active" field, default to "active"
  let status: "active" | "closed" | "archived" = "active";
  if (csvRow) {
    const isActiveStr = toString(csvRow["is active"]);
    if (isActiveStr) {
      const normalizedStatus = isActiveStr.toLowerCase().trim();
      if (normalizedStatus === "closed") {
        status = "closed";
      } else if (normalizedStatus === "active") {
        status = "active";
      }
    }
  }

  // Handle canceled appointments
  if (acuityData.canceled) {
    status = "closed"; // or you could skip these entirely
  }

  const bookingId = uuidv4();

  await tx.insert(newSchema.bookings).values({
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
    cancelledAt: acuityData.canceled ? acuityDateTime : null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  stats.bookingsCreated++;

  return bookingId;
}

/**
 * Create booking from Acuity data with CSV fallback
 * Returns booking ID
 * @deprecated Use createBookingInTransaction instead
 */
async function createBooking(
  acuityData: AcuityAppointmentData,
  csvRow: CSVBookingRow | null,
  referrerId: string,
  examineeId: string
): Promise<string | null> {
  // Primary data source: Acuity
  const acuityAppointmentId = acuityData.id;
  const acuityAppointmentTypeId = acuityData.appointmentTypeID;
  const acuityCalendarId = acuityData.calendarID;
  const duration = parseInt(acuityData.duration, 10);

  // Parse datetime from Acuity
  const acuityDateTime = parseDate(acuityData.datetime);
  if (!acuityDateTime) {
    throw new Error(`Failed to parse datetime from Acuity: ${acuityData.datetime}`);
  }

  // Determine booking type from Acuity appointment type field
  const bookingType = acuityData.type?.toLowerCase().includes("telehealth")
    ? "telehealth"
    : "in-person";

  // Get specialist by calendar ID
  const specialistId = specialistCalendarToIdMap.get(acuityCalendarId);
  if (!specialistId) {
    throw new Error(`Specialist not found for Acuity calendar ID: ${acuityCalendarId}`);
  }

  // Get location from CSV if available, otherwise empty
  const location = csvRow ? toString(csvRow["Location/Meet URL"]) : "";

  // Map status from CSV "is active" field, default to "active"
  let status: "active" | "closed" | "archived" = "active";
  if (csvRow) {
    const isActiveStr = toString(csvRow["is active"]);
    if (isActiveStr) {
      const normalizedStatus = isActiveStr.toLowerCase().trim();
      if (normalizedStatus === "closed") {
        status = "closed";
      } else if (normalizedStatus === "active") {
        status = "active";
      }
    }
  }

  // Handle canceled appointments
  if (acuityData.canceled) {
    status = "closed"; // or you could skip these entirely
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
    cancelledAt: acuityData.canceled ? acuityDateTime : null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  stats.bookingsCreated++;

  return bookingId;
}

/**
 * Create initial booking progress within a transaction
 */
async function createInitialProgressInTransaction(tx: any, bookingId: string) {
  await tx.insert(newSchema.bookingProgress).values({
    id: uuidv4(),
    bookingId,
    fromStatus: null,
    toStatus: "scheduled",
    changedById: SYSTEM_USER_ID_STR,
    createdAt: new Date(),
  });

  stats.progressCreated++;
}

/**
 * Create initial booking progress
 * @deprecated Use createInitialProgressInTransaction instead
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

async function processAcuityAppointment(
  acuityData: AcuityAppointmentData,
  index: number
): Promise<boolean> {
  try {
    console.log(`\n📝 Processing appointment ${index + 1} (AAID: ${acuityData.id})...`);

    // Step 0: Check if booking already exists (by AAID)
    const existingBooking = await dbClient<{ id: string }[]>`
      SELECT id FROM bookings WHERE acuity_appointment_id = ${acuityData.id} LIMIT 1
    `;

    if (existingBooking.length > 0) {
      stats.bookingsAlreadyExist++;
      console.log(`   ⊙ Skipped: Booking with AAID ${acuityData.id} already exists (ID: ${existingBooking[0].id})`);
      return true; // Return true so it's not counted as an error
    }

    // Step 1: Find CSV data for this appointment
    const csvRow = findCSVDataByAAID(acuityData.id);
    if (!csvRow) {
      stats.appointmentsWithoutCSVData++;
      stats.appointmentsSkipped++;
      stats.skippedAppointments.push({
        appointmentId: acuityData.id,
        reason: "Not found in CSV",
      });
      console.log(`   ⚠️  Warning: No CSV data found for AAID ${acuityData.id} - skipping`);
      return true; // Not an error, just missing data
    }
    console.log(`   ✓ Found CSV data for AAID ${acuityData.id}`);

    // Step 2-5: Create referrer, examinee, booking, and progress in a transaction
    // If any step fails, everything gets rolled back
    const result = await db.transaction(async (tx) => {
      // Step 2: Create referrer (from CSV)
      const referrerResult = await createReferrerInTransaction(tx, csvRow);
      if (!referrerResult.id) {
        const errorMsg = referrerResult.error || "Missing referrer data in CSV";
        throw new Error(errorMsg);
      }
      console.log(`   ✓ Referrer: ${referrerResult.id}`);

      // Step 3: Create examinee (from CSV)
      const examineeResult = await createExamineeInTransaction(tx, csvRow, referrerResult.id);
      if (!examineeResult.id) {
        const errorMsg = examineeResult.error || "Missing examinee data in CSV";
        throw new Error(errorMsg);
      }
      console.log(`   ✓ Examinee: ${examineeResult.id}`);

      // Step 4: Create booking (Acuity data + CSV fallback)
      const bookingId = await createBookingInTransaction(tx, acuityData, csvRow, referrerResult.id, examineeResult.id);
      if (!bookingId) {
        throw new Error("Failed to create booking");
      }
      console.log(`   ✓ Booking: ${bookingId}`);

      // Step 5: Create initial progress
      await createInitialProgressInTransaction(tx, bookingId);
      console.log(`   ✓ Progress created`);

      return { success: true, bookingId };
    }).catch((error) => {
      // Transaction failed and was rolled back
      const errorMsg = error instanceof Error ? error.message : "Transaction failed";
      stats.appointmentsSkipped++;
      stats.skippedAppointments.push({
        appointmentId: acuityData.id,
        reason: errorMsg,
      });
      stats.errors.push({
        appointmentId: acuityData.id,
        reason: errorMsg,
        data: csvRow,
      });
      console.log(`   ❌ Skipped: ${errorMsg}`);
      return { success: false, error: errorMsg };
    });

    if (!result.success) {
      return false;
    }

    console.log(`   ✅ Appointment ${acuityData.id} processed successfully`);
    return true;
  } catch (error) {
    const errorReason = error instanceof Error ? error.message : "Unknown error";
    stats.appointmentsSkipped++;
    stats.skippedAppointments.push({
      appointmentId: acuityData.id,
      reason: errorReason,
    });
    stats.errors.push({
      appointmentId: acuityData.id,
      reason: errorReason,
      data: acuityData,
    });
    console.error(`   ❌ Error processing appointment ${acuityData.id}:`, error);
    return false;
  }
}

async function runMigration() {
  console.log("🚀 Starting Acuity to Database Migration\n");
  console.log("=".repeat(60));
  console.log();

  const startTime = Date.now();

  try {
    // Prerequisites
    await checkPrerequisites();

    // Load specialist mappings
    await loadSpecialistMappings();

    // Parse and index CSV for lookup
    parseAndIndexCSV();

    // Get date range from environment or prompt
    let startDate = START_DATE;
    let endDate = END_DATE;

    if (!startDate || !endDate) {
      const dateRange = await promptForDateRange();
      startDate = dateRange.startDate;
      endDate = dateRange.endDate;
    }

    console.log(`📅 Date range: ${startDate} to ${endDate}\n`);

    // Fetch appointments from Acuity for the date range
    console.log("🔌 Fetching appointments from Acuity...\n");
    let appointments = await fetchAcuityAppointmentsForDateRange(startDate, endDate);

    if (appointments.length === 0) {
      console.warn("⚠️  No appointments found for this date range in Acuity");
      return;
    }

    console.log(`   ✓ Found ${appointments.length} appointments in Acuity\n`);

    // Test mode: only process first appointment
    if (TEST_MODE) {
      console.log(`🧪 Test mode: Processing only the first appointment\n`);
      appointments = [appointments[0]];
    }

    console.log("⚙️  Starting import...\n");
    console.log("-".repeat(60));

    // Process each appointment
    for (let i = 0; i < appointments.length; i++) {
      await processAcuityAppointment(appointments[i], i);
    }

    // Summary
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log("\n" + "=".repeat(60));
    console.log("✅ Migration completed!\n");

    // Skipped Appointments Summary
    if (stats.skippedAppointments.length > 0) {
      console.log("⏭️  Skipped Appointments Summary:");
      console.log(`   - Total: ${stats.skippedAppointments.length}\n`);
      stats.skippedAppointments.forEach((skipped) => {
        console.log(`   - Acuity Appointment ID: ${skipped.appointmentId} | Reason: ${skipped.reason}`);
      });
      console.log("\n" + "=".repeat(60));
      console.log();
    }

    console.log("📊 Migration Summary:");
    console.log(`   - Total appointments processed: ${appointments.length}`);
    console.log(`   - Appointments without CSV data: ${stats.appointmentsWithoutCSVData}`);
    console.log(`   - Referrers created: ${stats.referrersCreated}`);
    console.log(`   - Examinees created: ${stats.examineesCreated}`);
    console.log(`   - Bookings created: ${stats.bookingsCreated}`);
    console.log(`   - Bookings already exist (skipped): ${stats.bookingsAlreadyExist}`);
    console.log(`   - Progress records created: ${stats.progressCreated}`);
    console.log(`   - Appointments skipped: ${stats.appointmentsSkipped}`);
    console.log(`   - Duration: ${duration} seconds`);
    console.log();
    console.log("🔌 Acuity API Statistics:");
    console.log(`   - API calls made: ${acuityApiCalls}`);
    console.log(`   - API errors: ${acuityApiErrors}`);

    if (stats.errors.length > 0) {
      console.log(`\n⚠️  Errors encountered: ${stats.errors.length}`);
      console.log("\nError details:");
      stats.errors.forEach((error) => {
        console.log(`   Appointment ${error.appointmentId}: ${error.reason}`);
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
