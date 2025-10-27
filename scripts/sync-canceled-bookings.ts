/**
 * Acuity Canceled Bookings Sync Script
 *
 * Synchronizes canceled appointments from Acuity to database:
 * - Fetches canceled appointments from Acuity for a specific date range
 * - For each canceled appointment, checks if booking exists in database
 * - If exists, marks the booking as closed with cancellation timestamp
 * - If doesn't exist, skips it
 *
 * Prerequisites:
 * - Bookings must already exist in database (run migrate-bookings-csv.ts first)
 * - Acuity API credentials
 *
 * Usage:
 *   # Interactive mode (will prompt for dates)
 *   tsx scripts/sync-canceled-bookings.ts
 *
 *   # With environment variables
 *   START_DATE=2025-10-01 END_DATE=2025-10-31 tsx scripts/sync-canceled-bookings.ts
 *
 *   # Dry run mode (check what would be updated without making changes)
 *   DRY_RUN=true START_DATE=2025-10-01 END_DATE=2025-10-31 tsx scripts/sync-canceled-bookings.ts
 */

// Set migration mode flag BEFORE any imports that might use env
process.env.MIGRATION_MODE = "true";

import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import * as newSchema from "@/server/db/schema";
import { eq } from "drizzle-orm";
import * as readline from "readline";

// ============================================================================
// CONFIGURATION
// ============================================================================

const DB_URL = process.env.DATABASE_URL;
const ACUITY_USER_ID = process.env.ACUITY_USER_ID;
const ACUITY_API_KEY = process.env.ACUITY_API_KEY;

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

if (DRY_RUN) {
  console.log("🔍 DRY RUN MODE - Will check what would be updated without making changes\n");
}

// Database connection
const dbClient: Sql = postgres(DB_URL);
const db = drizzle(dbClient, { schema: newSchema });

// ============================================================================
// ACUITY API TYPE DEFINITIONS
// ============================================================================

interface AcuityCanceledAppointment {
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
  canceled: boolean;
}

// ============================================================================
// STATISTICS
// ============================================================================

const stats = {
  totalCanceledFromAcuity: 0,
  bookingsFound: 0,
  bookingsNotFound: 0,
  bookingsAlreadyClosed: 0,
  bookingsUpdated: 0,
  updatedBookings: [] as Array<{
    bookingId: string;
    acuityAppointmentId: number;
    appointmentDate: string;
    examineeName: string;
  }>,
  errors: [] as Array<{ appointmentId: number; reason: string }>,
};

// API statistics
let acuityApiCalls = 0;
let acuityApiErrors = 0;

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
 * Fetches all canceled appointments for a specific date range from Acuity API
 * Returns array of canceled appointments
 */
async function fetchCanceledAppointmentsFromAcuity(
  startDate: string,
  endDate: string
): Promise<AcuityCanceledAppointment[]> {
  try {
    const max = "1000";
    const canceled = "true"; // Only fetch canceled appointments

    console.log(`   📅 Fetching canceled appointments from ${startDate} to ${endDate}...`);

    // Rate limiting
    await rateLimitDelay();

    acuityApiCalls++;

    const authString = Buffer.from(`${ACUITY_USER_ID}:${ACUITY_API_KEY}`).toString("base64");
    const url = new URL("https://acuityscheduling.com/api/v1/appointments");
    url.searchParams.append("minDate", startDate);
    url.searchParams.append("maxDate", endDate);
    url.searchParams.append("max", max);
    url.searchParams.append("canceled", canceled);

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Basic ${authString}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      acuityApiErrors++;
      throw new Error(
        `Failed to fetch canceled appointments from Acuity: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as AcuityCanceledAppointment[];

    console.log(`   ✓ Fetched ${data.length} canceled appointments from Acuity`);

    return data;
  } catch (error) {
    acuityApiErrors++;
    console.error(`   ❌ Error fetching canceled appointments from Acuity:`, error);
    throw error;
  }
}

// ============================================================================
// SYNC FUNCTIONS
// ============================================================================

/**
 * Process a single canceled appointment
 * Returns true if successful, false if error
 */
async function processCanceledAppointment(
  appointment: AcuityCanceledAppointment,
  index: number
): Promise<boolean> {
  try {
    console.log(
      `\n📝 Processing canceled appointment ${index + 1} (AAID: ${appointment.id})...`
    );

    // Check if booking exists in database
    const existingBooking = await db.query.bookings.findFirst({
      where: eq(newSchema.bookings.acuityAppointmentId, appointment.id),
      columns: {
        id: true,
        status: true,
        cancelledAt: true,
        dateTime: true,
      },
      with: {
        examinee: {
          columns: {
            firstName: true,
            lastName: true,
          },
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

    // Check if already marked as closed
    if (existingBooking.status === "closed") {
      stats.bookingsAlreadyClosed++;
      console.log(
        `   ⊙ Skipped: Booking already marked as closed (ID: ${existingBooking.id})`
      );
      return true; // Not an error, already in correct state
    }

    // Track updated booking for report
    const examineeName = existingBooking.examinee
      ? `${existingBooking.examinee.firstName} ${existingBooking.examinee.lastName}`
      : "Unknown";

    const appointmentDate = existingBooking.dateTime
      ? new Date(existingBooking.dateTime).toISOString().split('T')[0]
      : appointment.date;

    stats.updatedBookings.push({
      bookingId: existingBooking.id,
      acuityAppointmentId: appointment.id,
      appointmentDate,
      examineeName,
    });

    // Update booking to closed status
    if (DRY_RUN) {
      console.log(
        `   🔍 DRY RUN: Would update booking ${existingBooking.id} to closed status`
      );
      stats.bookingsUpdated++;
    } else {
      await db
        .update(newSchema.bookings)
        .set({
          status: "closed",
          cancelledAt: new Date(appointment.datetime),
          updatedAt: new Date(),
        })
        .where(eq(newSchema.bookings.id, existingBooking.id));

      stats.bookingsUpdated++;
      console.log(`   ✅ Updated booking ${existingBooking.id} to closed status`);
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
  console.log("🚀 Starting Acuity Canceled Bookings Sync\n");
  console.log("=".repeat(60));
  console.log();

  const startTime = Date.now();

  try {
    // Get date range from environment or prompt
    let startDate = START_DATE;
    let endDate = END_DATE;

    if (!startDate || !endDate) {
      const dateRange = await promptForDateRange();
      startDate = dateRange.startDate;
      endDate = dateRange.endDate;
    }

    console.log(`📅 Date range: ${startDate} to ${endDate}\n`);

    // Fetch canceled appointments from Acuity for the date range
    console.log("🔌 Fetching canceled appointments from Acuity...\n");
    const canceledAppointments = await fetchCanceledAppointmentsFromAcuity(startDate, endDate);

    if (canceledAppointments.length === 0) {
      console.warn("⚠️  No canceled appointments found for this date range in Acuity");
      return;
    }

    stats.totalCanceledFromAcuity = canceledAppointments.length;
    console.log(`   ✓ Found ${canceledAppointments.length} canceled appointments in Acuity\n`);

    console.log("⚙️  Starting sync...\n");
    console.log("-".repeat(60));

    // Process each canceled appointment
    for (let i = 0; i < canceledAppointments.length; i++) {
      await processCanceledAppointment(canceledAppointments[i], i);
    }

    // Summary
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log("\n" + "=".repeat(60));
    console.log("✅ Sync completed!\n");

    // Updated Bookings Report
    if (stats.updatedBookings.length > 0) {
      console.log("📋 Updated Bookings Report:");
      console.log("-".repeat(60));
      console.log(`${"Booking ID".padEnd(38)} ${"Date".padEnd(12)} ${"AAID".padEnd(8)} Examinee`);
      console.log("-".repeat(60));

      // Sort by date
      const sortedBookings = [...stats.updatedBookings].sort((a, b) =>
        a.appointmentDate.localeCompare(b.appointmentDate)
      );

      sortedBookings.forEach((booking) => {
        console.log(
          `${booking.bookingId.padEnd(38)} ${booking.appointmentDate.padEnd(12)} ${String(booking.acuityAppointmentId).padEnd(8)} ${booking.examineeName}`
        );
      });
      console.log("-".repeat(60));
      console.log(`Total: ${stats.updatedBookings.length} booking${stats.updatedBookings.length === 1 ? '' : 's'}\n`);
    }

    console.log("📊 Sync Summary:");
    console.log(`   - Total canceled appointments in Acuity: ${stats.totalCanceledFromAcuity}`);
    console.log(`   - Bookings found in database: ${stats.bookingsFound}`);
    console.log(`   - Bookings not found in database: ${stats.bookingsNotFound}`);
    console.log(`   - Bookings already closed: ${stats.bookingsAlreadyClosed}`);
    console.log(`   - Bookings ${DRY_RUN ? "that would be " : ""}updated: ${stats.bookingsUpdated}`);
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
    console.log("✨ All done! Canceled bookings have been synchronized.\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Fatal error during sync:", error);
    process.exit(1);
  });
