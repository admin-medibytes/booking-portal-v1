/**
 * Focused Migration Script: Booking Data Only (Old DB → New DB)
 *
 * Migrates only booking-related tables:
 * - referrers (all external, no userId)
 * - examinees
 * - bookings
 * - progress → booking_progress
 *
 * Prerequisites:
 * - Specialists must already exist in new database
 * - DEFAULT_ORGANIZATION_ID must exist
 * - SYSTEM_USER_ID must exist
 * - Both databases accessible
 *
 * Usage:
 *   tsx scripts/migrate-bookings-only.ts
 */

// Set migration mode flag BEFORE any imports that might use env
process.env.MIGRATION_MODE = "true";

import "dotenv/config";
import { drizzle as drizzleOld } from "drizzle-orm/postgres-js";
import { drizzle as drizzleNew } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import { v4 as uuidv4 } from "uuid";
import * as newSchema from "@/server/db/schema";

// ============================================================================
// CONFIGURATION
// ============================================================================

const OLD_DB_URL = process.env.OLD_DATABASE_URL;
const NEW_DB_URL = process.env.DATABASE_URL;
const DEFAULT_ORGANIZATION_ID = process.env.DEFAULT_ORGANIZATION_ID;
const SYSTEM_USER_ID = process.env.SYSTEM_USER_ID;

// Test mode: only migrate one booking for testing
const TEST_MODE = process.env.TEST_MODE === "true";
const TEST_LIMIT = TEST_MODE ? 1 : undefined;

// Validate environment variables
if (!OLD_DB_URL) {
  throw new Error("❌ OLD_DATABASE_URL environment variable is required");
}
if (!NEW_DB_URL) {
  throw new Error("❌ DATABASE_URL environment variable is required");
}
if (!DEFAULT_ORGANIZATION_ID) {
  throw new Error("❌ DEFAULT_ORGANIZATION_ID environment variable is required");
}
if (!SYSTEM_USER_ID) {
  throw new Error("❌ SYSTEM_USER_ID environment variable is required");
}

if (TEST_MODE) {
  console.log("🧪 TEST MODE ENABLED - Will only migrate 1 booking and its related data\n");
}

// Database connections
const oldClient: Sql = postgres(OLD_DB_URL);
const newClient: Sql = postgres(NEW_DB_URL);
const oldDb = drizzleOld(oldClient);
const newDb = drizzleNew(newClient, { schema: newSchema });

// Narrow env types for subsequent use (validated above)
const DEFAULT_ORGANIZATION_ID_STR: string = DEFAULT_ORGANIZATION_ID as string;
const SYSTEM_USER_ID_STR: string = SYSTEM_USER_ID as string;

// ============================================================================
// TYPE DEFINITIONS (OLD SCHEMA)
// ============================================================================

interface OldReferrer {
  id: string;
  user_id?: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  job_title?: string;
  created_at: Date | string;
  updated_at: Date | string;
}

interface OldExaminee {
  id: string;
  referrer_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  address: string;
  email: string;
  phone_number?: string;
  authorized_contact: boolean;
  condition: string;
  case_type: string;
  created_at: Date | string;
  updated_at: Date | string;
}

interface OldBooking {
  id: string;
  referrer_id: string;
  specialist_id: string;
  examinee_id: string;
  status: string;
  type: string;
  duration: number;
  location: string;
  datetime?: Date | string;
  acuity_appointment_id: number;
  acuity_calendar_id: number;
  scheduled_at?: Date | string;
  completed_at?: Date | string;
  cancelled_at?: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
}

interface OldProgress {
  id: string;
  booking_id: string;
  from_status?: string;
  to_status: string;
  changed_by: string;
  created_at: Date | string;
}

// ============================================================================
// ID MAPPING STORAGE
// ============================================================================

const oldToNewReferrerMap = new Map<string, string>();
const oldToNewExamineeMap = new Map<string, string>();
const oldToNewBookingMap = new Map<string, string>();
const oldToNewSpecialistMap = new Map<string, string>();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Convert string or Date to Date object
function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  return new Date(value);
}

// Convert any value to string (handles arrays, objects, etc.)
function toString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

// ============================================================================
// STATUS MAPPING FUNCTIONS
// ============================================================================

function mapBookingStatus(oldStatus: string): "active" | "closed" | "archived" {
  const normalized = oldStatus?.toLowerCase().trim();
  const statusMap: Record<string, "active" | "closed" | "archived"> = {
    active: "active",
    closed: "closed",
    archived: "archived",
    pending: "active",
    confirmed: "active",
    scheduled: "active",
  };
  return statusMap[normalized] || "active";
}

function mapBookingProgressStatus(
  oldStatus: string
):
  | "scheduled"
  | "rescheduled"
  | "cancelled"
  | "no-show"
  | "generating-report"
  | "report-generated"
  | "payment-received" {
  const normalized = oldStatus.toLowerCase().trim();
  const statusMap: Record<
    string,
    | "scheduled"
    | "rescheduled"
    | "cancelled"
    | "no-show"
    | "generating-report"
    | "report-generated"
    | "payment-received"
  > = {
    scheduled: "scheduled",
    rescheduled: "rescheduled",
    cancelled: "cancelled",
    canceled: "cancelled", // Handle both spellings
    "no-show": "no-show",
    "no show": "no-show",
    noshow: "no-show",
    "generating-report": "generating-report",
    "generating report": "generating-report",
    "report-generated": "report-generated",
    "report generated": "report-generated",
    "payment-received": "payment-received",
    "payment received": "payment-received",
  };
  return statusMap[normalized] || "scheduled";
}

// ============================================================================
// PREREQUISITE CHECKS
// ============================================================================

async function checkPrerequisites() {
  console.log("🔍 Checking prerequisites...\n");

  try {
    // Check if organization exists
    const orgCheck = await newClient<{ count: string }[]>`
      SELECT COUNT(*) as count FROM organizations WHERE id = ${DEFAULT_ORGANIZATION_ID_STR}
    `;

    if (parseInt(orgCheck[0].count) === 0) {
      throw new Error(
        `Organization with ID ${DEFAULT_ORGANIZATION_ID} does not exist in new database`
      );
    }
    console.log(`   ✓ Organization ${DEFAULT_ORGANIZATION_ID} exists`);

    // Check if system user exists
    const userCheck = await newClient<{ count: string }[]>`
      SELECT COUNT(*) as count FROM users WHERE id = ${SYSTEM_USER_ID_STR}
    `;

    if (parseInt(userCheck[0].count) === 0) {
      throw new Error(`System user with ID ${SYSTEM_USER_ID} does not exist in new database`);
    }
    console.log(`   ✓ System user ${SYSTEM_USER_ID} exists`);

    // Check specialists exist
    const specialistsCheck = await newClient<{ count: string }[]>`
      SELECT COUNT(*) as count FROM specialists
    `;

    const specialistCount = parseInt(specialistsCheck[0].count);
    if (specialistCount === 0) {
      console.warn(
        "   ⚠️  WARNING: No specialists found in new database. Bookings referencing specialists will be skipped."
      );
    } else {
      console.log(`   ✓ Found ${specialistCount} specialists in new database`);
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
  console.log("👨‍⚕️ Loading specialist ID mappings...");

  // Load old specialists with their acuity_calendar_id
  const oldSpecialists = await oldClient<{ id: string; acuity_calendar_id: number }[]>`
    SELECT id, acuity_calendar_id FROM specialists
  `;

  // Load new specialists with their acuity_calendar_id
  const newSpecialists = await newClient<{ id: string; acuity_calendar_id: number }[]>`
    SELECT id, acuity_calendar_id FROM specialists
  `;

  console.log(`   Found ${oldSpecialists.length} specialists in old database`);
  console.log(`   Found ${newSpecialists.length} specialists in new database`);

  // Create a map of acuity_calendar_id → new specialist ID
  const acuityCalendarToNewId = new Map<number, string>();
  for (const newSpec of newSpecialists) {
    acuityCalendarToNewId.set(newSpec.acuity_calendar_id, newSpec.id);
  }

  // Map old specialist IDs to new specialist IDs using acuity_calendar_id as the key
  let mappedCount = 0;
  let unmappedCount = 0;

  for (const oldSpec of oldSpecialists) {
    const newId = acuityCalendarToNewId.get(oldSpec.acuity_calendar_id);
    if (newId) {
      oldToNewSpecialistMap.set(oldSpec.id, newId);
      mappedCount++;
    } else {
      unmappedCount++;
      console.warn(
        `   ⚠️  No matching specialist found for old ID ${oldSpec.id} (acuity_calendar_id: ${oldSpec.acuity_calendar_id})`
      );
    }
  }

  console.log(`   ✓ Mapped ${mappedCount} specialists via acuity_calendar_id`);

  if (unmappedCount > 0) {
    console.warn(
      `   ⚠️  WARNING: ${unmappedCount} specialists could not be mapped. Bookings for these specialists will be skipped.`
    );
  }

  if (mappedCount === 0 && oldSpecialists.length > 0) {
    console.error(
      "   ❌ ERROR: No specialists could be mapped! Please verify specialists exist in new database."
    );
  }

  console.log();
}

// ============================================================================
// MIGRATION FUNCTIONS
// ============================================================================

async function migrateReferrers(referrerIds?: Set<string>) {
  console.log("📋 Migrating referrers (all as external)...");

  let oldReferrers: OldReferrer[];

  if (referrerIds && referrerIds.size > 0) {
    // Only migrate specific referrers (test mode)
    const idsArray = Array.from(referrerIds);
    oldReferrers = await oldClient<OldReferrer[]>`
      SELECT * FROM referrers WHERE id = ANY(${idsArray}) ORDER BY created_at ASC
    `;
  } else {
    // Migrate all referrers
    oldReferrers = await oldClient<OldReferrer[]>`
      SELECT * FROM referrers ORDER BY created_at ASC
    `;
  }

  console.log(`   Found ${oldReferrers.length} referrers to migrate`);

  let migrated = 0;
  let skipped = 0;

  for (const oldRef of oldReferrers) {
    try {
      await newDb.insert(newSchema.referrers).values({
        id: oldRef.id, // Keep the same ID from old database
        organizationId: DEFAULT_ORGANIZATION_ID_STR,
        userId: null, // All external referrers
        firstName: toString(oldRef.first_name),
        lastName: toString(oldRef.last_name),
        email: toString(oldRef.email) || "",
        phone: toString(oldRef.phone) || "",
        jobTitle: oldRef.job_title ? toString(oldRef.job_title) : null,
        createdAt: toDate(oldRef.created_at)!,
        updatedAt: toDate(oldRef.updated_at)!,
      });

      oldToNewReferrerMap.set(oldRef.id, oldRef.id); // Map to same ID
      migrated++;

      if (migrated % 100 === 0) {
        console.log(`   Progress: ${migrated}/${oldReferrers.length} referrers migrated`);
      }
    } catch (error) {
      console.error(`   ❌ Failed to migrate referrer ${oldRef.id}:`, error);
      skipped++;
    }
  }

  console.log(`   ✓ Migrated ${migrated} referrers`);
  if (skipped > 0) {
    console.log(`   ⚠️  Skipped ${skipped} referrers due to errors`);
  }
  console.log();
}

async function migrateExaminees(examineeIds?: Set<string>) {
  console.log("🧑 Migrating examinees...");

  let oldExaminees: OldExaminee[];

  if (examineeIds && examineeIds.size > 0) {
    // Only migrate specific examinees (test mode)
    const idsArray = Array.from(examineeIds);
    oldExaminees = await oldClient<OldExaminee[]>`
      SELECT * FROM examinees WHERE id = ANY(${idsArray}) ORDER BY created_at ASC
    `;
  } else {
    // Migrate all examinees
    oldExaminees = await oldClient<OldExaminee[]>`
      SELECT * FROM examinees ORDER BY created_at ASC
    `;
  }

  console.log(`   Found ${oldExaminees.length} examinees to migrate`);

  let migrated = 0;
  let skipped = 0;

  for (const oldExam of oldExaminees) {
    const newReferrerId = oldToNewReferrerMap.get(oldExam.referrer_id);

    if (!newReferrerId) {
      console.warn(
        `   ⚠️  Skipping examinee ${oldExam.id} - referrer ${oldExam.referrer_id} not found`
      );
      skipped++;
      continue;
    }

    try {
      await newDb.insert(newSchema.examinees).values({
        id: oldExam.id, // Keep the same ID from old database
        referrerId: newReferrerId,
        firstName: toString(oldExam.first_name),
        lastName: toString(oldExam.last_name),
        dateOfBirth: toString(oldExam.date_of_birth),
        address: toString(oldExam.address),
        email: toString(oldExam.email),
        phoneNumber: toString(oldExam.phone_number) || "",
        authorizedContact: oldExam.authorized_contact,
        condition: toString(oldExam.condition),
        caseType: toString(oldExam.case_type),
        createdAt: toDate(oldExam.created_at)!,
        updatedAt: toDate(oldExam.updated_at)!,
      });

      oldToNewExamineeMap.set(oldExam.id, oldExam.id); // Map to same ID
      migrated++;

      if (migrated % 100 === 0) {
        console.log(`   Progress: ${migrated}/${oldExaminees.length} examinees migrated`);
      }
    } catch (error) {
      console.error(`   ❌ Failed to migrate examinee ${oldExam.id}:`, error);
      skipped++;
    }
  }

  console.log(`   ✓ Migrated ${migrated} examinees`);
  if (skipped > 0) {
    console.log(`   ⚠️  Skipped ${skipped} examinees due to errors`);
  }
  console.log();
}

async function migrateBookings(bookingIds?: Set<string>) {
  console.log("📅 Migrating bookings...");

  let oldBookings: OldBooking[];

  if (bookingIds && bookingIds.size > 0) {
    // Test mode: only migrate specific bookings
    const idsArray = Array.from(bookingIds);
    oldBookings = await oldClient<OldBooking[]>`
      SELECT * FROM bookings WHERE id = ANY(${idsArray}) ORDER BY created_at ASC
    `;
  } else {
    // Migrate all bookings
    oldBookings = await oldClient<OldBooking[]>`
      SELECT * FROM bookings ORDER BY created_at ASC
    `;
  }

  console.log(`   Found ${oldBookings.length} bookings to migrate`);

  let migrated = 0;
  let skipped = 0;
  const skipReasons = {
    missingReferrer: 0,
    missingSpecialist: 0,
    missingExaminee: 0,
    otherError: 0,
  };

  for (const oldBooking of oldBookings) {
    const newReferrerId = oldToNewReferrerMap.get(oldBooking.referrer_id);
    const newSpecialistId = oldToNewSpecialistMap.get(oldBooking.specialist_id);
    const newExamineeId = oldToNewExamineeMap.get(oldBooking.examinee_id);

    // Check all required references
    if (!newReferrerId) {
      skipReasons.missingReferrer++;
      skipped++;
      continue;
    }

    if (!newSpecialistId) {
      skipReasons.missingSpecialist++;
      skipped++;
      continue;
    }

    if (!newExamineeId) {
      skipReasons.missingExaminee++;
      skipped++;
      continue;
    }

    try {
      const bookingType = oldBooking.type?.toLowerCase() === "telehealth" ? "telehealth" : "in-person";

      // Skip bookings with missing required Acuity fields
      if (!oldBooking.acuity_appointment_id) {
        console.warn(
          `   ⚠️  Skipping booking ${oldBooking.id} - missing acuity_appointment_id`
        );
        skipReasons.otherError++;
        skipped++;
        continue;
      }

      await newDb.insert(newSchema.bookings).values({
        id: oldBooking.id, // Keep the same ID from old database
        organizationId: DEFAULT_ORGANIZATION_ID_STR,
        teamId: null,
        createdById: SYSTEM_USER_ID_STR,
        referrerId: newReferrerId,
        specialistId: newSpecialistId,
        examineeId: newExamineeId,
        status: mapBookingStatus(oldBooking.status),
        type: bookingType,
        duration: oldBooking.duration,
        location: oldBooking.location,
        dateTime: toDate(oldBooking.datetime),
        acuityAppointmentId: oldBooking.acuity_appointment_id,
        acuityAppointmentTypeId: oldBooking.acuity_appointment_id,
        acuityCalendarId: oldBooking.acuity_calendar_id,
        scheduledAt: toDate(oldBooking.scheduled_at),
        completedAt: toDate(oldBooking.completed_at),
        cancelledAt: toDate(oldBooking.cancelled_at),
        createdAt: toDate(oldBooking.created_at)!,
        updatedAt: toDate(oldBooking.updated_at)!,
      });

      oldToNewBookingMap.set(oldBooking.id, oldBooking.id); // Map to same ID
      migrated++;

      if (migrated % 100 === 0) {
        console.log(`   Progress: ${migrated}/${oldBookings.length} bookings migrated`);
      }
    } catch (error) {
      console.error(`   ❌ Failed to migrate booking ${oldBooking.id}:`, error);
      skipReasons.otherError++;
      skipped++;
    }
  }

  console.log(`   ✓ Migrated ${migrated} bookings`);
  if (skipped > 0) {
    console.log(`   ⚠️  Skipped ${skipped} bookings:`);
    if (skipReasons.missingReferrer > 0) {
      console.log(`      - ${skipReasons.missingReferrer} due to missing referrer`);
    }
    if (skipReasons.missingSpecialist > 0) {
      console.log(`      - ${skipReasons.missingSpecialist} due to missing specialist`);
    }
    if (skipReasons.missingExaminee > 0) {
      console.log(`      - ${skipReasons.missingExaminee} due to missing examinee`);
    }
    if (skipReasons.otherError > 0) {
      console.log(`      - ${skipReasons.otherError} due to other errors`);
    }
  }
  console.log();
}

async function migrateProgress(bookingIds?: Set<string>) {
  console.log("📊 Migrating booking progress...");

  let oldProgress: OldProgress[];

  if (bookingIds && bookingIds.size > 0) {
    // Only migrate progress for specific bookings (test mode)
    const idsArray = Array.from(bookingIds);
    oldProgress = await oldClient<OldProgress[]>`
      SELECT * FROM progress WHERE booking_id = ANY(${idsArray}) ORDER BY created_at ASC
    `;
  } else {
    // Migrate all progress records
    oldProgress = await oldClient<OldProgress[]>`
      SELECT * FROM progress ORDER BY created_at ASC
    `;
  }

  console.log(`   Found ${oldProgress.length} progress records to migrate`);

  let migrated = 0;
  let skipped = 0;

  for (const oldProg of oldProgress) {
    const newBookingId = oldToNewBookingMap.get(oldProg.booking_id);

    if (!newBookingId) {
      skipped++;
      continue;
    }

    try {
      await newDb.insert(newSchema.bookingProgress).values({
        id: uuidv4(),
        bookingId: newBookingId,
        fromStatus: oldProg.from_status ? mapBookingProgressStatus(oldProg.from_status) : null,
        toStatus: mapBookingProgressStatus(oldProg.to_status),
        changedById: oldProg.changed_by || SYSTEM_USER_ID_STR,
        createdAt: toDate(oldProg.created_at)!,
      });

      migrated++;

      if (migrated % 100 === 0) {
        console.log(`   Progress: ${migrated}/${oldProgress.length} progress records migrated`);
      }
    } catch (error) {
      console.error(`   ❌ Failed to migrate progress ${oldProg.id}:`, error);
      skipped++;
    }
  }

  console.log(`   ✓ Migrated ${migrated} progress records`);
  if (skipped > 0) {
    console.log(`   ⚠️  Skipped ${skipped} progress records (missing booking references)`);
  }
  console.log();
}

// ============================================================================
// MAIN MIGRATION ORCHESTRATOR
// ============================================================================

async function runMigration() {
  console.log("🚀 Starting Booking Data Migration\n");
  console.log("=".repeat(60));
  console.log();

  const startTime = Date.now();

  try {
    // Prerequisites
    await checkPrerequisites();

    // Load existing mappings
    await loadSpecialistMappings();

    // In test mode, first get the IDs we need to migrate
    let testReferrerIds: Set<string> | undefined;
    let testExamineeIds: Set<string> | undefined;
    let testBookingIds: Set<string> | undefined;

    if (TEST_MODE) {
      console.log("🔍 Test Mode: Finding a valid booking with complete data...\n");

      // Get all bookings first, then filter in JavaScript
      // (Old database might have different column names)
      const allBookings = await oldClient<OldBooking[]>`
        SELECT * FROM bookings ORDER BY created_at DESC
      `;

      if (allBookings.length === 0) {
        throw new Error("No bookings found in old database");
      }

      // Find first booking with all required Acuity fields
      const validBooking = allBookings.find(
        (b) =>
          b.acuity_appointment_id != null &&
          b.acuity_appointment_id != null &&
          b.acuity_calendar_id != null
      );

      if (!validBooking) {
        console.warn("   ⚠️  No bookings with complete Acuity data found. Using first available booking...");
        const booking = allBookings[0];
        testBookingIds = new Set([booking.id]);
        testReferrerIds = new Set([booking.referrer_id]);
        testExamineeIds = new Set([booking.examinee_id]);

        console.log(`   Booking ID: ${booking.id}`);
        console.log(`   Referrer ID: ${booking.referrer_id}`);
        console.log(`   Examinee ID: ${booking.examinee_id}`);
        console.log(`   Specialist ID: ${booking.specialist_id}`);
        console.log(`   ⚠️  Note: This booking may be skipped if missing required fields\n`);
      } else {
        testBookingIds = new Set([validBooking.id]);
        testReferrerIds = new Set([validBooking.referrer_id]);
        testExamineeIds = new Set([validBooking.examinee_id]);

        console.log(`   ✓ Found valid booking with complete data`);
        console.log(`   Booking ID: ${validBooking.id}`);
        console.log(`   Referrer ID: ${validBooking.referrer_id}`);
        console.log(`   Examinee ID: ${validBooking.examinee_id}`);
        console.log(`   Specialist ID: ${validBooking.specialist_id}`);
        console.log(`   Acuity Appointment Type ID: ${validBooking.acuity_appointment_id}\n`);
      }
    }

    // Phase 1: Referrers
    console.log("📦 Phase 1: Migrating Referrers");
    console.log("-".repeat(60));
    await migrateReferrers(testReferrerIds);

    // Phase 2: Examinees
    console.log("📦 Phase 2: Migrating Examinees");
    console.log("-".repeat(60));
    await migrateExaminees(testExamineeIds);

    // Phase 3: Bookings
    console.log("📦 Phase 3: Migrating Bookings");
    console.log("-".repeat(60));
    await migrateBookings(testBookingIds);

    // Phase 4: Progress
    console.log("📦 Phase 4: Migrating Progress");
    console.log("-".repeat(60));
    await migrateProgress(testBookingIds);

    // Summary
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log("=".repeat(60));
    console.log("✅ Migration completed successfully!\n");
    console.log("📊 Migration Summary:");
    console.log(`   - Referrers: ${oldToNewReferrerMap.size} migrated`);
    console.log(`   - Examinees: ${oldToNewExamineeMap.size} migrated`);
    console.log(`   - Bookings: ${oldToNewBookingMap.size} migrated`);
    console.log(`   - Duration: ${duration} seconds`);
    console.log();
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    throw error;
  } finally {
    await oldClient.end();
    await newClient.end();
  }
}

// ============================================================================
// EXECUTE MIGRATION
// ============================================================================

runMigration()
  .then(() => {
    console.log("✨ All done! Your booking data has been migrated.\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Fatal error during migration:", error);
    process.exit(1);
  });
