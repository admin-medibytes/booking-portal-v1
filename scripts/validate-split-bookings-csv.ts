/**
 * CSV Validation Script: Split Valid and Invalid Data
 *
 * Validates booking CSV data and splits into two files:
 * - Valid data: Ready for import
 * - Invalid data: Rows with errors + error descriptions
 *
 * Prerequisites:
 * - Specialists must already exist in database (for specialist email validation)
 * - CSV file with booking data
 *
 * Usage:
 *   tsx scripts/validate-split-bookings-csv.ts
 *
 * Output:
 *   - {filename}-valid.csv - All valid rows
 *   - {filename}-invalid.csv - All invalid rows with "Validation_Errors" column
 */

// Set migration mode flag BEFORE any imports that might use env
process.env.MIGRATION_MODE = "true";

import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import * as newSchema from "@/server/db/schema";
import * as fs from "fs";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";

// ============================================================================
// CONFIGURATION
// ============================================================================

const DB_URL = process.env.DATABASE_URL;

// CSV file path (relative to project root)
const CSV_FILE_PATH = process.env.CSV_FILE_PATH || "./data/bookings.csv";

// Validate environment variables
if (!DB_URL) {
  throw new Error("❌ DATABASE_URL environment variable is required");
}

console.log("🔍 CSV Validation and Split Tool\n");

// Database connection
const dbClient: Sql = postgres(DB_URL);
const db = drizzle(dbClient, { schema: newSchema });

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface CSVBookingRow {
  [key: string]: string;
}

interface ValidationError {
  field: string;
  issue: string;
  value?: string;
}

interface RowValidationResult {
  row: CSVBookingRow;
  rowIndex: number;
  isValid: boolean;
  errors: ValidationError[];
}

// ============================================================================
// SPECIALIST MAPPINGS
// ============================================================================

const specialistEmailToIdMap = new Map<string, string>();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function toString(value: string | null | undefined, defaultValue = ""): string {
  if (value === null || value === undefined || value.trim() === "") {
    return defaultValue;
  }
  return value.trim();
}

function parseBoolean(value: string | null | undefined): boolean {
  if (!value) return false;
  const normalized = value.toLowerCase().trim();
  return normalized === "true" || normalized === "yes" || normalized === "1";
}

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

function combineDateAndTime(dateStr: string, timeStr: string): Date | null {
  if (!dateStr || !timeStr) return null;

  try {
    const combined = `${dateStr} ${timeStr}`;
    const date = new Date(combined);
    if (!isNaN(date.getTime())) return date;
    return null;
  } catch {
    return null;
  }
}

function parseInteger(value: string | null | undefined, defaultValue = 0): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
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
      const normalizedEmail = specialist.user.email.toLowerCase().trim();
      specialistEmailToIdMap.set(normalizedEmail, specialist.id);
    }
  }

  console.log(`   ✓ Loaded ${specialistEmailToIdMap.size} specialist mappings by email\n`);
}

// ============================================================================
// VALIDATION FUNCTION
// ============================================================================

function validateRow(row: CSVBookingRow, rowIndex: number): RowValidationResult {
  const errors: ValidationError[] = [];

  const addError = (field: string, issue: string, value?: string) => {
    errors.push({ field, issue, value });
  };

  // ===== CLAIMANT (EXAMINEE) VALIDATION =====
  const claimantFirstName = toString(row["Claimant First Name"]);
  const claimantLastName = toString(row["Claimant Last Name"]);
  const claimantDOB = toString(row["Claimant DOB"]);
  const claimantAddress = toString(row["Claimant Address"]);
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

  return {
    row,
    rowIndex,
    isValid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// CSV PARSING
// ============================================================================

function parseCSV(): CSVBookingRow[] {
  console.log("📄 Reading CSV file...");

  if (!fs.existsSync(CSV_FILE_PATH)) {
    throw new Error(`CSV file not found at path: ${CSV_FILE_PATH}`);
  }

  const fileContent = fs.readFileSync(CSV_FILE_PATH, "utf-8");

  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }) as CSVBookingRow[];

  console.log(`   ✓ Parsed ${records.length} rows from CSV\n`);

  return records;
}

// ============================================================================
// VALIDATION AND SPLITTING
// ============================================================================

async function validateAndSplit() {
  console.log("🚀 Starting CSV Validation and Split\n");
  console.log("=".repeat(60));
  console.log();

  const startTime = Date.now();

  try {
    // Load specialist mappings
    await loadSpecialistMappings();

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

    console.log("🔍 Validating all rows...\n");

    // Validate all rows
    const validationResults: RowValidationResult[] = [];
    const aaidSet = new Set<string>();
    const duplicateAAIDs = new Map<string, number[]>(); // AAID -> row numbers

    for (let i = 0; i < rows.length; i++) {
      const result = validateRow(rows[i], i);
      validationResults.push(result);

      // Check for duplicate AAIDs
      const aaid = toString(rows[i]["AAID"]);
      if (aaid) {
        if (aaidSet.has(aaid)) {
          if (!duplicateAAIDs.has(aaid)) {
            duplicateAAIDs.set(aaid, []);
          }
          duplicateAAIDs.get(aaid)!.push(i + 1);
          result.errors.push({
            field: "AAID",
            issue: "Duplicate AAID found - must be unique",
            value: aaid,
          });
          result.isValid = false;
        }
        aaidSet.add(aaid);
      }
    }

    // Separate valid and invalid rows
    const validRows = validationResults.filter((r) => r.isValid);
    const invalidRows = validationResults.filter((r) => !r.isValid);

    console.log("📊 Validation Results:");
    console.log(`   - Total rows: ${rows.length}`);
    console.log(`   - Valid rows: ${validRows.length}`);
    console.log(`   - Invalid rows: ${invalidRows.length}`);
    console.log();

    // Generate output filenames
    const inputPath = CSV_FILE_PATH;
    const pathParts = inputPath.split("/");
    const filename = pathParts[pathParts.length - 1];
    const filenameWithoutExt = filename.replace(/\.csv$/i, "");
    const directory = pathParts.slice(0, -1).join("/") || ".";

    const validOutputPath = `${directory}/${filenameWithoutExt}-valid.csv`;
    const invalidOutputPath = `${directory}/${filenameWithoutExt}-invalid.csv`;

    // Write valid rows to CSV
    if (validRows.length > 0) {
      const validData = validRows.map((r) => r.row);
      const validCSV = stringify(validData, {
        header: true,
        columns: Object.keys(rows[0]),
      });
      fs.writeFileSync(validOutputPath, validCSV);
      console.log(`✅ Valid data written to: ${validOutputPath}`);
      console.log(`   ${validRows.length} rows ready for import\n`);
    } else {
      console.log(`⚠️  No valid rows to write\n`);
    }

    // Write invalid rows to CSV with error column
    if (invalidRows.length > 0) {
      const invalidData = invalidRows.map((r) => {
        const errorMessages = r.errors
          .map((e) => {
            if (e.value) {
              return `${e.field}: ${e.issue} (value: "${e.value}")`;
            }
            return `${e.field}: ${e.issue}`;
          })
          .join("; ");

        return {
          ...r.row,
          Validation_Errors: errorMessages,
        };
      });

      const columns = [...Object.keys(rows[0]), "Validation_Errors"];
      const invalidCSV = stringify(invalidData, {
        header: true,
        columns,
      });
      fs.writeFileSync(invalidOutputPath, invalidCSV);
      console.log(`❌ Invalid data written to: ${invalidOutputPath}`);
      console.log(`   ${invalidRows.length} rows need fixing\n`);
    } else {
      console.log(`✅ No invalid rows found\n`);
    }

    // Show error summary
    if (invalidRows.length > 0) {
      console.log("📋 Error Summary by Field:\n");

      const errorsByField = new Map<string, number>();
      for (const result of invalidRows) {
        for (const error of result.errors) {
          const count = errorsByField.get(error.field) || 0;
          errorsByField.set(error.field, count + 1);
        }
      }

      const sortedFields = Array.from(errorsByField.entries()).sort((a, b) => b[1] - a[1]);
      for (const [field, count] of sortedFields) {
        console.log(`   ${field}: ${count} error(s)`);
      }
      console.log();
    }

    // Duration
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log("=".repeat(60));
    console.log(`✨ Validation completed in ${duration} seconds\n`);

    if (validRows.length > 0) {
      console.log(`💡 Next steps:`);
      console.log(`   1. Review invalid data in: ${invalidOutputPath}`);
      console.log(`   2. Fix errors and re-run validation`);
      console.log(`   3. Import valid data using: pnpm import:bookings\n`);
    }
  } catch (error) {
    console.error("\n❌ Validation failed:", error);
    throw error;
  } finally {
    await dbClient.end();
  }
}

// ============================================================================
// EXECUTE
// ============================================================================

validateAndSplit()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Fatal error:", error);
    process.exit(1);
  });
