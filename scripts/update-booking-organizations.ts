/**
 * Update Booking Organizations Script
 *
 * Updates booking organization assignments based on "Referrer Org" from CSV:
 * - Reads CSV with booking data including "Referrer Org" field
 * - Searches for organization by slug (generated from org name)
 * - Updates booking with found organization ID
 * - Falls back to DEFAULT_ORGANIZATION_ID if not found
 *
 * Prerequisites:
 * - Bookings must already exist in database (with AAID)
 * - Organizations must be imported via import-organizations-csv script
 * - DEFAULT_ORGANIZATION_ID must exist
 * - CSV file with booking data including "Referrer Org" and "AAID"
 *
 * Usage:
 *   # Test mode (update only 1 booking)
 *   TEST_MODE=true tsx scripts/update-booking-organizations.ts
 *
 *   # Update all bookings
 *   tsx scripts/update-booking-organizations.ts
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

// ============================================================================
// CONFIGURATION
// ============================================================================

const DB_URL = process.env.DATABASE_URL;
const DEFAULT_ORGANIZATION_ID = process.env.DEFAULT_ORGANIZATION_ID;

// CSV file path (relative to project root)
const CSV_FILE_PATH = process.env.CSV_FILE_PATH || "./data/bookings-valid.csv";

// Test mode: only update one booking for testing
const TEST_MODE = process.env.TEST_MODE === "true";

// Validate environment variables
if (!DB_URL) {
  throw new Error("❌ DATABASE_URL environment variable is required");
}
if (!DEFAULT_ORGANIZATION_ID) {
  throw new Error("❌ DEFAULT_ORGANIZATION_ID environment variable is required");
}

if (TEST_MODE) {
  console.log("🧪 TEST MODE ENABLED - Will only update 1 booking\n");
}

// Database connection
const dbClient: Sql = postgres(DB_URL);
const db = drizzle(dbClient, { schema: newSchema });

// Narrow env types for subsequent use (validated above)
const DEFAULT_ORGANIZATION_ID_STR: string = DEFAULT_ORGANIZATION_ID as string;

// ============================================================================
// TYPE DEFINITIONS (CSV ROW)
// ============================================================================

interface CSVBookingRow {
  "AAID": string; // Acuity Appointment ID - used to find booking
  "Referrer Org": string; // Organization name to search for
  [key: string]: string; // Allow other fields
}

// ============================================================================
// STATISTICS
// ============================================================================

const stats = {
  bookingsUpdated: 0,
  bookingsNotFound: 0,
  bookingsWithDefaultOrg: 0,
  bookingsWithMatchedOrg: 0,
  rowsSkipped: 0,
  errors: [] as Array<{ row: number; reason: string; aaid?: string }>,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a URL-friendly slug from organization name
 * Example: "ABC Corporation" -> "abc-corporation"
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove special characters
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
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
 * Parse integer from string
 */
function parseInteger(value: string | null | undefined, defaultValue = 0): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

// ============================================================================
// ORGANIZATION LOOKUP
// ============================================================================

const organizationSlugToIdMap = new Map<string, string>();

async function loadOrganizations() {
  console.log("🏢 Loading organizations...");

  const organizations = await db.query.organizations.findMany({
    columns: {
      id: true,
      name: true,
      slug: true,
    },
  });

  console.log(`   Found ${organizations.length} organizations in database`);

  for (const org of organizations) {
    // Only add organizations with valid slugs
    if (org.slug) {
      organizationSlugToIdMap.set(org.slug, org.id);
    }
  }

  console.log(`   ✓ Loaded ${organizationSlugToIdMap.size} organization mappings`);
  console.log();
}

/**
 * Find organization ID by name (via slug lookup)
 * Returns organization ID or DEFAULT_ORGANIZATION_ID if not found
 */
function findOrganizationId(orgName: string): string {
  if (!orgName || orgName.trim() === "") {
    return DEFAULT_ORGANIZATION_ID_STR;
  }

  const slug = generateSlug(orgName);
  const orgId = organizationSlugToIdMap.get(slug);

  if (orgId) {
    return orgId;
  }

  // Not found, return default
  return DEFAULT_ORGANIZATION_ID_STR;
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

    // Check if default organization exists
    const orgCheck = await dbClient<{ count: string }[]>`
      SELECT COUNT(*) as count FROM organizations WHERE id = ${DEFAULT_ORGANIZATION_ID_STR}
    `;

    if (parseInt(orgCheck[0].count) === 0) {
      throw new Error(
        `Default organization with ID ${DEFAULT_ORGANIZATION_ID} does not exist in database`
      );
    }
    console.log(`   ✓ Default organization ${DEFAULT_ORGANIZATION_ID} exists`);

    console.log();
  } catch (error) {
    console.error("❌ Prerequisites check failed:", error);
    throw error;
  }
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
// UPDATE FUNCTIONS
// ============================================================================

/**
 * Update booking organization based on CSV row
 */
async function updateBookingOrganization(
  row: CSVBookingRow,
  rowIndex: number
): Promise<boolean> {
  try {
    console.log(`\n📝 Processing row ${rowIndex + 1}...`);

    const aaidStr = toString(row["AAID"]);
    const referrerOrg = toString(row["Referrer Org"]);

    if (!aaidStr) {
      stats.errors.push({
        row: rowIndex + 1,
        reason: "Missing AAID",
      });
      stats.rowsSkipped++;
      console.log(`   ❌ Skipped: Missing AAID`);
      return false;
    }

    const aaid = parseInteger(aaidStr);
    if (aaid === 0) {
      stats.errors.push({
        row: rowIndex + 1,
        reason: "Invalid AAID format",
        aaid: aaidStr,
      });
      stats.rowsSkipped++;
      console.log(`   ❌ Skipped: Invalid AAID format`);
      return false;
    }

    // Find booking by acuityAppointmentId
    const booking = await db.query.bookings.findFirst({
      where: eq(newSchema.bookings.acuityAppointmentId, aaid),
      columns: {
        id: true,
        organizationId: true,
      },
    });

    if (!booking) {
      stats.errors.push({
        row: rowIndex + 1,
        reason: `Booking not found for AAID: ${aaid}`,
        aaid: aaidStr,
      });
      stats.bookingsNotFound++;
      console.log(`   ❌ Booking not found for AAID: ${aaid}`);
      return false;
    }

    console.log(`   ✓ Found booking: ${booking.id}`);

    // Find organization ID from referrer org name
    const organizationId = findOrganizationId(referrerOrg);

    if (organizationId === DEFAULT_ORGANIZATION_ID_STR) {
      console.log(`   ℹ️  Using default organization (org not found: "${referrerOrg}")`);
      stats.bookingsWithDefaultOrg++;
    } else {
      console.log(`   ✓ Matched organization: "${referrerOrg}" -> ${organizationId}`);
      stats.bookingsWithMatchedOrg++;
    }

    // Update booking organization
    await db
      .update(newSchema.bookings)
      .set({
        organizationId,
        updatedAt: new Date(),
      })
      .where(eq(newSchema.bookings.id, booking.id));

    stats.bookingsUpdated++;
    console.log(`   ✅ Updated booking ${booking.id} with organization ${organizationId}`);

    return true;
  } catch (error) {
    stats.errors.push({
      row: rowIndex + 1,
      reason: error instanceof Error ? error.message : "Unknown error",
      aaid: row["AAID"],
    });
    stats.rowsSkipped++;
    console.error(`   ❌ Error processing row ${rowIndex + 1}:`, error);
    return false;
  }
}

// ============================================================================
// MAIN UPDATE ORCHESTRATOR
// ============================================================================

async function runUpdate() {
  console.log("🚀 Starting Booking Organization Update\n");
  console.log("=".repeat(60));
  console.log();

  const startTime = Date.now();

  try {
    // Prerequisites
    await checkPrerequisites();

    // Load organizations
    await loadOrganizations();

    // Parse CSV
    const rows = parseCSV();

    if (rows.length === 0) {
      console.warn("⚠️  No rows found in CSV file");
      return;
    }

    // Show CSV structure
    console.log("📋 CSV Columns detected:");
    console.log("   " + Object.keys(rows[0]).join(", "));
    console.log();

    // Validate CSV has required columns
    if (!rows[0].hasOwnProperty("AAID")) {
      throw new Error('CSV must have an "AAID" column');
    }
    if (!rows[0].hasOwnProperty("Referrer Org")) {
      throw new Error('CSV must have a "Referrer Org" column');
    }

    console.log("⚙️  Starting update...\n");
    console.log("-".repeat(60));

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      await updateBookingOrganization(rows[i], i);
    }

    // Summary
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log("\n" + "=".repeat(60));
    console.log("✅ Update completed!\n");
    console.log("📊 Update Summary:");
    console.log(`   - Total rows processed: ${rows.length}`);
    console.log(`   - Bookings updated: ${stats.bookingsUpdated}`);
    console.log(`   - Bookings with matched org: ${stats.bookingsWithMatchedOrg}`);
    console.log(`   - Bookings with default org: ${stats.bookingsWithDefaultOrg}`);
    console.log(`   - Bookings not found: ${stats.bookingsNotFound}`);
    console.log(`   - Rows skipped: ${stats.rowsSkipped}`);
    console.log(`   - Duration: ${duration} seconds`);

    if (stats.errors.length > 0) {
      console.log(`\n⚠️  Errors encountered: ${stats.errors.length}`);
      console.log("\nError details:");
      stats.errors.slice(0, 20).forEach((error) => {
        if (error.aaid) {
          console.log(`   Row ${error.row}: ${error.reason} (AAID: ${error.aaid})`);
        } else {
          console.log(`   Row ${error.row}: ${error.reason}`);
        }
      });
      if (stats.errors.length > 20) {
        console.log(`   ... and ${stats.errors.length - 20} more errors`);
      }
    }

    console.log();
  } catch (error) {
    console.error("\n❌ Update failed:", error);
    throw error;
  } finally {
    await dbClient.end();
  }
}

// ============================================================================
// EXECUTE UPDATE
// ============================================================================

runUpdate()
  .then(() => {
    console.log("✨ All done! Booking organizations have been updated.\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Fatal error during update:", error);
    process.exit(1);
  });
