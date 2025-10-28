/**
 * Acuity Rescheduled Bookings Sync Script
 *
 * Synchronizes rescheduled appointments from Acuity to database:
 * - Fetches all appointments from Acuity for a specific date range
 * - Checks CSV data to find appointments marked as "Rescheduled"
 * - For each rescheduled appointment, checks if booking exists in database
 * - If exists, updates the datetime to match Acuity and creates progress entry
 * - If doesn't exist, skips it
 *
 * Prerequisites:
 * - Bookings must already exist in database (run migrate-bookings-csv.ts first)
 * - CSV file with booking data (for Status lookup)
 * - Acuity API credentials
 *
 * Usage:
 *   # Interactive mode (will prompt for dates)
 *   tsx scripts/sync-rescheduled-bookings.ts
 *
 *   # With environment variables
 *   START_DATE=2025-10-01 END_DATE=2025-10-31 tsx scripts/sync-rescheduled-bookings.ts
 *
 *   # Dry run mode (check what would be updated without making changes)
 *   DRY_RUN=true START_DATE=2025-10-01 END_DATE=2025-10-31 tsx scripts/sync-rescheduled-bookings.ts
 */

// Set migration mode flag BEFORE any imports that might use env
process.env.MIGRATION_MODE = "true";

import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import * as newSchema from "@/server/db/schema";
import { eq } from "drizzle-orm";
import * as fs from "fs";
import { parse } from "csv-parse/sync";
import * as readline from "readline";
import { v4 as uuidv4 } from "uuid";

// ============================================================================
// CONFIGURATION
// ============================================================================

const DB_URL = process.env.DATABASE_URL;
const ACUITY_USER_ID = process.env.ACUITY_USER_ID;
const ACUITY_API_KEY = process.env.ACUITY_API_KEY;
const SYSTEM_USER_ID = process.env.SYSTEM_USER_ID;

// CSV file path (relative to project root) - used for Status lookup
const CSV_FILE_PATH = process.env.CSV_FILE_PATH || "./data/bookings.csv";

// Date range to fetch appointments from Acuity (format: YYYY-MM-DD)
const START_DATE = process.env.START_DATE;
const END_DATE = process.env.END_DATE;

// Dry run mode: only check what would be updated, don't make changes
const DRY_RUN = process.env.DRY_RUN === "true";

// Validate environment variables
if (!DB_URL) {
  throw new Error("❌ DATABASE_URL environment variable is required");
}
if (!ACUITY_USER_ID) {
  throw new Error("❌ ACUITY_USER_ID environment variable is required");
}
if (!ACUITY_API_KEY) {
  throw new Error("❌ ACUITY_API_KEY environment variable is required");
}
if (!SYSTEM_USER_ID) {
  throw new Error("❌ SYSTEM_USER_ID environment variable is required");
}

if (DRY_RUN) {
  console.log("🔍 DRY RUN MODE - Will check what would be updated without making changes\n");
}

// Database connection
const dbClient: Sql = postgres(DB_URL);
const db = drizzle(dbClient, { schema: newSchema });

// Narrow env types for subsequent use
const SYSTEM_USER_ID_STR: string = SYSTEM_USER_ID as string;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface CSVBookingRow {
  "AAID": string;
  "Status": string;
  // Add other fields as needed
  [key: string]: string;
}

interface AcuityAppointment {
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
  totalAppointmentsFromAcuity: 0,
  rescheduledInCSV: 0,
  bookingsFound: 0,
  bookingsNotFound: 0,
  bookingsAlreadyUpToDate: 0,
  bookingsUpdated: 0,
  updatedBookings: [] as Array<{
    bookingId: string;
    acuityAppointmentId: number;
    oldDateTime: string;
    newDateTime: string;
    examineeName: string;
  }>,
  errors: [] as Array<{ appointmentId: number; reason: string }>,
};

// API statistics
let acuityApiCalls = 0;
let acuityApiErrors = 0;

// CSV lookup by AAID
const csvDataByAAID = new Map<number, CSVBookingRow>();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

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
    rl.question("Start date (YYYY-MM-DD): ", (startAnswer) => {
      const startDate = startAnswer.trim();

      // Validate start date format
      const startMatch = startDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!startMatch) {
        console.error(
          `\n❌ Invalid start date format: "${startDate}". Expected format: YYYY-MM-DD (e.g., 2025-10-01)\n`
        );
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
      rl.question("End date (YYYY-MM-DD): ", (endAnswer) => {
        rl.close();
        const endDate = endAnswer.trim();

        // Validate end date format
        const endMatch = endDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!endMatch) {
          console.error(
            `\n❌ Invalid end date format: "${endDate}". Expected format: YYYY-MM-DD (e.g., 2025-10-31)\n`
          );
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
          console.error(
            `\n❌ End date (${endDate}) must be after or equal to start date (${startDate})\n`
          );
          process.exit(1);
        }

        resolve({ startDate, endDate });
      });
    });
  });
}

// ============================================================================
// CSV PARSING AND INDEXING
// ============================================================================

function parseAndIndexCSV(): void {
  console.log("📄 Reading and indexing CSV file...");

  // Check if CSV file exists
  if (!fs.existsSync(CSV_FILE_PATH)) {
    throw new Error(`CSV file not found at path: ${CSV_FILE_PATH}`);
  }

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

/**
 * Check if appointment is marked as rescheduled in CSV
 */
function isRescheduledInCSV(aaid: number): boolean {
  const csvRow = findCSVDataByAAID(aaid);
  if (!csvRow) return false;

  const status = csvRow["Status"]?.toLowerCase().trim();
  return status === "rescheduled";
}

// ============================================================================
// ACUITY API FUNCTIONS
// ============================================================================

/**
 * Simple rate limiter - delays execution to respect API rate limits
 * Acuity allows ~10 requests per second
 */
async function rateLimitDelay() {
  await new Promise((resolve) => setTimeout(resolve, 120)); // 120ms = ~8 requests/second (safe margin)
}

/**
 * Fetches all appointments for a specific date range from Acuity API
 * Returns array of appointments
 */
async function fetchAppointmentsFromAcuity(
  startDate: string,
  endDate: string
): Promise<AcuityAppointment[]> {
  try {
    const max = "1000";
    const showall = "true";

    console.log(`   📅 Fetching appointments from ${startDate} to ${endDate}...`);

    // Rate limiting
    await rateLimitDelay();

    acuityApiCalls++;

    const authString = Buffer.from(`${ACUITY_USER_ID}:${ACUITY_API_KEY}`).toString("base64");
    const url = new URL("https://acuityscheduling.com/api/v1/appointments");
    url.searchParams.append("minDate", startDate);
    url.searchParams.append("maxDate", endDate);
    url.searchParams.append("max", max);
    url.searchParams.append("showall", showall);

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Basic ${authString}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      acuityApiErrors++;
      throw new Error(
        `Failed to fetch appointments from Acuity: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as AcuityAppointment[];

    console.log(`   ✓ Fetched ${data.length} appointments from Acuity`);

    return data;
  } catch (error) {
    acuityApiErrors++;
    console.error(`   ❌ Error fetching appointments from Acuity:`, error);
    throw error;
  }
}

// ============================================================================
// SYNC FUNCTIONS
// ============================================================================

/**
 * Process a single rescheduled appointment
 * Returns true if successful, false if error
 */
async function processRescheduledAppointment(
  appointment: AcuityAppointment,
  index: number
): Promise<boolean> {
  try {
    console.log(
      `\n📝 Processing rescheduled appointment ${index + 1} (AAID: ${appointment.id})...`
    );

    // Check if appointment is marked as rescheduled in CSV
    if (!isRescheduledInCSV(appointment.id)) {
      console.log(`   ⊙ Skipped: Not marked as rescheduled in CSV (AAID: ${appointment.id})`);
      return true; // Not an error, just not rescheduled
    }

    stats.rescheduledInCSV++;

    // Check if booking exists in database
    const existingBooking = await db.query.bookings.findFirst({
      where: eq(newSchema.bookings.acuityAppointmentId, appointment.id),
      columns: {
        id: true,
        dateTime: true,
      },
      with: {
        examinee: {
          columns: {
            firstName: true,
            lastName: true,
          },
        },
        progress: {
          orderBy: (progress, { desc }) => [desc(progress.createdAt)],
          limit: 1,
        },
      },
    });

    if (!existingBooking) {
      stats.bookingsNotFound++;
      console.log(`   ⊙ Skipped: Booking not found in database (AAID: ${appointment.id})`);
      return true; // Not an error, just doesn't exist in our system
    }

    stats.bookingsFound++;
    console.log(`   ✓ Found booking in database (ID: ${existingBooking.id})`);

    // Parse new datetime from Acuity
    const newDateTime = new Date(appointment.datetime);
    if (isNaN(newDateTime.getTime())) {
      stats.errors.push({
        appointmentId: appointment.id,
        reason: `Invalid datetime from Acuity: ${appointment.datetime}`,
      });
      console.log(`   ❌ Error: Invalid datetime from Acuity (${appointment.datetime})`);
      return false;
    }

    // Check if datetime is already up to date
    const currentDateTime = existingBooking.dateTime ? new Date(existingBooking.dateTime) : null;
    if (currentDateTime && currentDateTime.getTime() === newDateTime.getTime()) {
      stats.bookingsAlreadyUpToDate++;
      console.log(
        `   ⊙ Skipped: Booking datetime already up to date (ID: ${existingBooking.id})`
      );
      return true; // Not an error, already in correct state
    }

    // Track updated booking for report
    const examineeName = existingBooking.examinee
      ? `${existingBooking.examinee.firstName} ${existingBooking.examinee.lastName}`
      : "Unknown";

    // Format datetime as "YYYY-MM-DD HH:MM" for readability
    const formatDateTime = (date: Date | null) => {
      if (!date) return "Unknown";
      const isoString = date.toISOString();
      const [datePart, timePart] = isoString.split('T');
      const timeOnly = timePart.substring(0, 5); // HH:MM
      return `${datePart} ${timeOnly}`;
    };

    const oldDateTime = formatDateTime(currentDateTime);
    const newDateTimeStr = formatDateTime(newDateTime);

    stats.updatedBookings.push({
      bookingId: existingBooking.id,
      acuityAppointmentId: appointment.id,
      oldDateTime,
      newDateTime: newDateTimeStr,
      examineeName,
    });

    // Get current progress status
    const currentProgress = existingBooking.progress[0]?.toStatus || "scheduled";

    // Update booking datetime and create progress entry
    if (DRY_RUN) {
      console.log(
        `   🔍 DRY RUN: Would update booking ${existingBooking.id} datetime from ${oldDateTime} to ${newDateTimeStr}`
      );
      stats.bookingsUpdated++;
    } else {
      await db.transaction(async (tx) => {
        // Update booking datetime
        await tx
          .update(newSchema.bookings)
          .set({
            dateTime: newDateTime,
            updatedAt: new Date(),
          })
          .where(eq(newSchema.bookings.id, existingBooking.id));

        // Create progress entry for reschedule
        await tx.insert(newSchema.bookingProgress).values({
          id: uuidv4(),
          bookingId: existingBooking.id,
          fromStatus: currentProgress,
          toStatus: "rescheduled",
          changedById: SYSTEM_USER_ID_STR,
          createdAt: new Date(),
        });
      });

      stats.bookingsUpdated++;
      console.log(
        `   ✅ Updated booking ${existingBooking.id} datetime from ${oldDateTime} to ${newDateTimeStr}`
      );
    }

    return true;
  } catch (error) {
    const errorReason = error instanceof Error ? error.message : "Unknown error";
    stats.errors.push({
      appointmentId: appointment.id,
      reason: errorReason,
    });
    console.error(`   ❌ Error processing appointment ${appointment.id}:`, error);
    return false;
  }
}

// ============================================================================
// MAIN SYNC ORCHESTRATOR
// ============================================================================

async function runSync() {
  console.log("🚀 Starting Acuity Rescheduled Bookings Sync\n");
  console.log("=".repeat(60));
  console.log();

  const startTime = Date.now();

  try {
    // Check if CSV file exists
    if (!fs.existsSync(CSV_FILE_PATH)) {
      throw new Error(`CSV file not found at path: ${CSV_FILE_PATH}`);
    }

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
    const appointments = await fetchAppointmentsFromAcuity(startDate, endDate);

    if (appointments.length === 0) {
      console.warn("⚠️  No appointments found for this date range in Acuity");
      return;
    }

    stats.totalAppointmentsFromAcuity = appointments.length;
    console.log(`   ✓ Found ${appointments.length} appointments in Acuity\n`);

    console.log("⚙️  Starting sync...\n");
    console.log("-".repeat(60));

    // Process each appointment (filtering happens in processRescheduledAppointment)
    for (let i = 0; i < appointments.length; i++) {
      await processRescheduledAppointment(appointments[i], i);
    }

    // Summary
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log("\n" + "=".repeat(60));
    console.log("✅ Sync completed!\n");

    // Updated Bookings Report
    if (stats.updatedBookings.length > 0) {
      console.log("📋 Updated Bookings Report:");
      console.log("-".repeat(120));
      console.log(
        `${"Booking ID".padEnd(38)} ${"AAID".padEnd(8)} ${"Old DateTime".padEnd(18)} ${"New DateTime".padEnd(18)} Examinee`
      );
      console.log("-".repeat(120));

      // Sort by new date
      const sortedBookings = [...stats.updatedBookings].sort((a, b) =>
        a.newDateTime.localeCompare(b.newDateTime)
      );

      sortedBookings.forEach((booking) => {
        console.log(
          `${booking.bookingId.padEnd(38)} ${String(booking.acuityAppointmentId).padEnd(8)} ${booking.oldDateTime.padEnd(18)} ${booking.newDateTime.padEnd(18)} ${booking.examineeName}`
        );
      });
      console.log("-".repeat(120));
      console.log(
        `Total: ${stats.updatedBookings.length} booking${stats.updatedBookings.length === 1 ? "" : "s"}\n`
      );
    }

    console.log("📊 Sync Summary:");
    console.log(`   - Total appointments from Acuity: ${stats.totalAppointmentsFromAcuity}`);
    console.log(`   - Appointments marked as rescheduled in CSV: ${stats.rescheduledInCSV}`);
    console.log(`   - Bookings found in database: ${stats.bookingsFound}`);
    console.log(`   - Bookings not found in database: ${stats.bookingsNotFound}`);
    console.log(`   - Bookings already up to date: ${stats.bookingsAlreadyUpToDate}`);
    console.log(
      `   - Bookings ${DRY_RUN ? "that would be " : ""}updated: ${stats.bookingsUpdated}`
    );
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

    if (DRY_RUN) {
      console.log("\n🔍 DRY RUN MODE - No changes were made to the database");
      console.log("   Run without DRY_RUN=true to apply the changes");
    }

    console.log();
  } catch (error) {
    console.error("\n❌ Sync failed:", error);
    throw error;
  } finally {
    await dbClient.end();
  }
}

// ============================================================================
// EXECUTE SYNC
// ============================================================================

runSync()
  .then(() => {
    console.log("✨ All done! Rescheduled bookings have been synchronized.\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Fatal error during sync:", error);
    process.exit(1);
  });
