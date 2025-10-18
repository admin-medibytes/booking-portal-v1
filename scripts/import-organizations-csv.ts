/**
 * CSV to Database Migration Script: Organizations
 *
 * Imports organizations from CSV file and creates:
 * - Organization record with auto-generated slug
 * - Main team for each organization ("<Organization Name> Main")
 *
 * CSV Format:
 * - Single column: "Organization"
 * - Each row contains an organization name
 *
 * Prerequisites:
 * - SYSTEM_USER_ID must exist
 * - CSV file with organization names
 *
 * Usage:
 *   # Test mode (import only 1 organization)
 *   TEST_MODE=true tsx scripts/import-organizations-csv.ts
 *
 *   # Import all organizations
 *   tsx scripts/import-organizations-csv.ts
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
import { parse } from "csv-parse/sync";

// ============================================================================
// CONFIGURATION
// ============================================================================

const DB_URL = process.env.DATABASE_URL;
const SYSTEM_USER_ID = process.env.SYSTEM_USER_ID;

// CSV file path (relative to project root)
const CSV_FILE_PATH = process.env.CSV_FILE_PATH || "./data/organizations.csv";

// Test mode: only import one organization for testing
const TEST_MODE = process.env.TEST_MODE === "true";

// Validate environment variables
if (!DB_URL) {
  throw new Error("❌ DATABASE_URL environment variable is required");
}
if (!SYSTEM_USER_ID) {
  throw new Error("❌ SYSTEM_USER_ID environment variable is required");
}

if (TEST_MODE) {
  console.log("🧪 TEST MODE ENABLED - Will only import 1 organization\n");
}

// Database connection
const dbClient: Sql = postgres(DB_URL);
const db = drizzle(dbClient, { schema: newSchema });

// Narrow env types for subsequent use (validated above)
const SYSTEM_USER_ID_STR: string = SYSTEM_USER_ID as string;

// ============================================================================
// TYPE DEFINITIONS (CSV ROW)
// ============================================================================

interface CSVOrganizationRow {
  Organization: string;
}

// ============================================================================
// STATISTICS
// ============================================================================

const stats = {
  organizationsCreated: 0,
  organizationsSkipped: 0,
  teamsCreated: 0,
  errors: [] as Array<{ row: number; reason: string; orgName?: string }>,
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
 * Ensure slug is unique by appending a number if needed
 */
async function ensureUniqueSlug(baseSlug: string): Promise<string> {
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await db.query.organizations.findFirst({
      where: eq(newSchema.organizations.slug, slug),
      columns: { id: true },
    });

    if (!existing) {
      return slug;
    }

    // Slug exists, try with counter
    slug = `${baseSlug}-${counter}`;
    counter++;
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

    // Check if system user exists
    const userCheck = await dbClient<{ count: string }[]>`
      SELECT COUNT(*) as count FROM users WHERE id = ${SYSTEM_USER_ID_STR}
    `;

    if (parseInt(userCheck[0].count) === 0) {
      throw new Error(`System user with ID ${SYSTEM_USER_ID} does not exist in database`);
    }
    console.log(`   ✓ System user ${SYSTEM_USER_ID} exists`);

    console.log();
  } catch (error) {
    console.error("❌ Prerequisites check failed:", error);
    throw error;
  }
}

// ============================================================================
// CSV PARSING
// ============================================================================

function parseCSV(): CSVOrganizationRow[] {
  console.log("📄 Reading CSV file...");

  const fileContent = fs.readFileSync(CSV_FILE_PATH, "utf-8");

  const records = parse(fileContent, {
    columns: true, // Use first row as column names
    skip_empty_lines: true,
    trim: true,
    bom: true, // Handle BOM in UTF-8 files
  }) as CSVOrganizationRow[];

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
 * Create organization and its main team
 */
async function createOrganizationWithTeam(
  orgName: string,
  rowIndex: number
): Promise<boolean> {
  try {
    console.log(`\n📝 Processing row ${rowIndex + 1}: "${orgName}"`);

    // Validate organization name
    if (!orgName || orgName.trim() === "") {
      stats.errors.push({
        row: rowIndex + 1,
        reason: "Empty organization name",
        orgName,
      });
      stats.organizationsSkipped++;
      console.log(`   ❌ Skipped: Empty organization name`);
      return false;
    }

    // Check if organization already exists (by name)
    const existingOrg = await db.query.organizations.findFirst({
      where: eq(newSchema.organizations.name, orgName),
      columns: { id: true, name: true },
    });

    if (existingOrg) {
      stats.errors.push({
        row: rowIndex + 1,
        reason: "Organization already exists",
        orgName,
      });
      stats.organizationsSkipped++;
      console.log(`   ⚠️  Skipped: Organization already exists (ID: ${existingOrg.id})`);
      return false;
    }

    // Generate unique slug
    const baseSlug = generateSlug(orgName);
    const uniqueSlug = await ensureUniqueSlug(baseSlug);
    console.log(`   ℹ️  Generated slug: "${uniqueSlug}"`);

    // Create organization
    const organizationId = uuidv4();
    await db.insert(newSchema.organizations).values({
      id: organizationId,
      name: orgName,
      slug: uniqueSlug,
      createdAt: new Date(),
    });

    stats.organizationsCreated++;
    console.log(`   ✓ Organization created: ${organizationId}`);

    // Create main team
    const teamName = `${orgName} Main`;
    const teamId = uuidv4();

    await db.insert(newSchema.teams).values({
      id: teamId,
      organizationId,
      name: teamName,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    stats.teamsCreated++;
    console.log(`   ✓ Team created: "${teamName}" (${teamId})`);

    console.log(`   ✅ Row ${rowIndex + 1} processed successfully`);
    return true;
  } catch (error) {
    stats.errors.push({
      row: rowIndex + 1,
      reason: error instanceof Error ? error.message : "Unknown error",
      orgName,
    });
    stats.organizationsSkipped++;
    console.error(`   ❌ Error processing row ${rowIndex + 1}:`, error);
    return false;
  }
}

// ============================================================================
// MAIN MIGRATION ORCHESTRATOR
// ============================================================================

async function runMigration() {
  console.log("🚀 Starting Organization CSV Import\n");
  console.log("=".repeat(60));
  console.log();

  const startTime = Date.now();

  try {
    // Prerequisites
    await checkPrerequisites();

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

    // Validate CSV has "Organization" column
    if (!rows[0].Organization && rows[0].Organization !== "") {
      throw new Error(
        'CSV must have an "Organization" column. Found columns: ' +
          Object.keys(rows[0]).join(", ")
      );
    }

    console.log("⚙️  Starting import...\n");
    console.log("-".repeat(60));

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const orgName = toString(rows[i].Organization);
      await createOrganizationWithTeam(orgName, i);
    }

    // Summary
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log("\n" + "=".repeat(60));
    console.log("✅ Import completed!\n");
    console.log("📊 Import Summary:");
    console.log(`   - Total rows processed: ${rows.length}`);
    console.log(`   - Organizations created: ${stats.organizationsCreated}`);
    console.log(`   - Organizations skipped: ${stats.organizationsSkipped}`);
    console.log(`   - Teams created: ${stats.teamsCreated}`);
    console.log(`   - Duration: ${duration} seconds`);

    if (stats.errors.length > 0) {
      console.log(`\n⚠️  Errors/Warnings encountered: ${stats.errors.length}`);
      console.log("\nDetails:");
      stats.errors.forEach((error) => {
        console.log(`   Row ${error.row}: ${error.reason}`);
        if (error.orgName) {
          console.log(`      Organization: "${error.orgName}"`);
        }
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
    console.log("✨ All done! Your organizations have been imported.\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Fatal error during import:", error);
    process.exit(1);
  });
