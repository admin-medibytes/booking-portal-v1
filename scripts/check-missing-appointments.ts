#!/usr/bin/env tsx

import { createInterface } from "readline/promises";
import { stdin as input, stdout as output } from "process";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import chalk from "chalk";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import { createCipheriv, randomBytes, scryptSync } from "crypto";

// Load environment variables
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

// ============================================================================
// ENCRYPTION UTILITIES (standalone - no env import)
// ============================================================================

const ALGORITHM = 'aes-256-gcm';
const TAG_LENGTH = 16;
const IV_LENGTH = 16;
const KEY_LENGTH = 32;

let cachedEncryptionKey: Buffer | null = null;

const getEncryptionKey = (): Buffer => {
  if (cachedEncryptionKey) {
    return cachedEncryptionKey;
  }

  const secret = process.env.ENCRYPTION_KEY || process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error('ENCRYPTION_KEY or BETTER_AUTH_SECRET must be set for data encryption');
  }
  const salt = Buffer.from('medibytes-encryption-salt', 'utf8');
  cachedEncryptionKey = scryptSync(secret, salt, KEY_LENGTH);
  return cachedEncryptionKey;
};

const encrypt = (text: string): string => {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(text, 'utf8'),
    cipher.final()
  ]);

  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, tag, encrypted]);

  return combined.toString('base64');
};

// Environment variable validation
const DEFAULT_ORGANIZATION_ID = process.env.DEFAULT_ORGANIZATION_ID;
const SYSTEM_USER_ID = process.env.SYSTEM_USER_ID;

if (!DEFAULT_ORGANIZATION_ID || !SYSTEM_USER_ID) {
  console.error(chalk.red("\n❌ Missing required environment variables:"));
  if (!DEFAULT_ORGANIZATION_ID) console.error(chalk.red("   - DEFAULT_ORGANIZATION_ID"));
  if (!SYSTEM_USER_ID) console.error(chalk.red("   - SYSTEM_USER_ID"));
  console.error(chalk.gray("\nThese are required for syncing appointments to the database."));
  console.error(chalk.gray("You can still check for missing appointments without syncing.\n"));
}

// Simple Acuity API client for this script
async function fetchAcuityAppointments(params: {
  minDate?: string;
  maxDate?: string;
}): Promise<any[]> {
  const userId = process.env.ACUITY_USER_ID;
  const apiKey = process.env.ACUITY_API_KEY;

  if (!userId || !apiKey) {
    throw new Error("ACUITY_USER_ID and ACUITY_API_KEY must be set in environment variables");
  }

  const auth = Buffer.from(`${userId}:${apiKey}`).toString("base64");
  const queryParams = new URLSearchParams();

  if (params.minDate) queryParams.set("minDate", params.minDate);
  if (params.maxDate) queryParams.set("maxDate", params.maxDate);
  queryParams.set("max", "1000");
  queryParams.set("canceled", "false");

  const url = `https://acuityscheduling.com/api/v1/appointments?${queryParams.toString()}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Acuity API request failed: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

async function checkMissingAppointments() {
  // Create database connection
  const client = postgres(
    process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/booking_portal"
  );
  const db = drizzle(client);

  const rl = createInterface({ input, output });
  console.log(chalk.blue("\n🔍 Acuity Appointment Checker\n"));
  console.log(chalk.gray("This script compares Acuity appointments with database bookings\n"));

  try {
    // Get month and year from user
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;

    console.log(chalk.yellow(`Current date: ${currentYear}-${currentMonth.toString().padStart(2, "0")}`));
    const yearInput = await rl.question(`Year to check (default: ${currentYear}): `);
    const monthInput = await rl.question(`Month to check (1-12, default: ${currentMonth}): `);

    const year = yearInput ? parseInt(yearInput) : currentYear;
    const month = monthInput ? parseInt(monthInput) : currentMonth;

    // Validate input
    if (isNaN(year) || year < 2000 || year > 2100) {
      console.log(chalk.red("❌ Invalid year"));
      process.exit(1);
    }

    if (isNaN(month) || month < 1 || month > 12) {
      console.log(chalk.red("❌ Invalid month (must be 1-12)"));
      process.exit(1);
    }

    // Calculate date range (using UTC to avoid timezone issues)
    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    // Format dates as YYYY-MM-DD (already in UTC, so no timezone conversion)
    const minDate = startDate.toISOString().split("T")[0]; // YYYY-MM-DD
    const maxDate = endDate.toISOString().split("T")[0]; // YYYY-MM-DD

    console.log(chalk.cyan(`\n📅 Checking appointments for ${year}-${month.toString().padStart(2, "0")}`));
    console.log(chalk.gray(`Date range: ${minDate} to ${maxDate}\n`));

    // Fetch appointments from Acuity
    console.log(chalk.blue("🔄 Fetching appointments from Acuity..."));
    const acuityAppointments = await fetchAcuityAppointments({
      minDate,
      maxDate,
    });
    console.log(chalk.green(`✅ Found ${acuityAppointments.length} appointments in Acuity\n`));

    // Check for cancelled appointments in Acuity
    const cancelledAcuityAppointments = acuityAppointments.filter(
      (apt: any) => apt.canceled === true || apt.canceled === "1" || apt.noShow === true
    );

    if (cancelledAcuityAppointments.length > 0) {
      console.log(
        chalk.yellow(
          `⚠️  Note: ${cancelledAcuityAppointments.length} appointments are cancelled/no-show in Acuity`
        )
      );
      console.log(chalk.gray("   (The Acuity calendar UI may hide these by default)\n"));
    }

    // Fetch bookings from database using raw SQL (avoiding schema imports that trigger env validation)
    console.log(chalk.blue("🔄 Fetching bookings from database..."));
    const dbBookings = (await db.execute(sql`
      SELECT id, acuity_appointment_id, date_time, status
      FROM bookings
      WHERE date_time >= ${startDate.toISOString()}
        AND date_time <= ${endDate.toISOString()}
    `)) as {
      id: string;
      acuity_appointment_id: number | null;
      date_time: Date;
      status: string;
    }[];
    console.log(chalk.green(`✅ Found ${dbBookings.length} bookings in database\n`));

    // Count bookings by status
    const bookingsByStatus = dbBookings.reduce(
      (acc, booking) => {
        acc[booking.status] = (acc[booking.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    console.log(chalk.cyan("Bookings by status:"));
    Object.entries(bookingsByStatus).forEach(([status, count]) => {
      console.log(chalk.white(`  ${status}: ${chalk.bold(count)}`));
    });
    console.log("");

    // Create a set of Acuity appointment IDs that exist in database
    const dbAcuityIds = new Set(
      dbBookings
        .filter((b) => b.acuity_appointment_id !== null)
        .map((b) => b.acuity_appointment_id)
    );

    // Find missing appointments
    const missingAppointments = acuityAppointments.filter(
      (apt) => !dbAcuityIds.has(apt.id)
    );

    // Calculate active bookings (matches calendar default view)
    const activeBookings = dbBookings.filter((b) => b.status === "active");
    const activeBookingsWithAcuityId = activeBookings.filter((b) => b.acuity_appointment_id !== null);

    // Calculate active Acuity appointments (excluding cancelled)
    const activeAcuityAppointments = acuityAppointments.filter(
      (apt: any) => !(apt.canceled === true || apt.canceled === "1" || apt.noShow === true)
    );

    // Display results
    console.log(chalk.bold("\n" + "=".repeat(80)));
    console.log(chalk.bold.cyan("📊 RESULTS"));
    console.log(chalk.bold("=".repeat(80) + "\n"));

    console.log(chalk.white(`Total Acuity Appointments (API):      ${chalk.bold(acuityAppointments.length)}`));
    console.log(chalk.white(`Active Acuity Appointments:           ${chalk.bold.green(activeAcuityAppointments.length)} ${chalk.gray("(calendar view)")}`));
    if (cancelledAcuityAppointments.length > 0) {
      console.log(chalk.white(`Cancelled/No-show in Acuity:          ${chalk.bold.yellow(cancelledAcuityAppointments.length)}`));
    }
    console.log("");
    console.log(chalk.white(`Total Database Bookings (ALL):        ${chalk.bold(dbBookings.length)}`));
    console.log(chalk.white(`Active Database Bookings:             ${chalk.bold.green(activeBookings.length)} ${chalk.gray("(calendar default)")}`));
    console.log(chalk.white(`Bookings with Acuity ID:              ${chalk.bold(dbAcuityIds.size)}`));
    console.log(
      chalk.white(
        `Missing Appointments:                 ${missingAppointments.length > 0 ? chalk.bold.red(missingAppointments.length) : chalk.bold.green(missingAppointments.length)}\n`
      )
    );

    if (missingAppointments.length > 0) {
      console.log(chalk.bold.red("⚠️  MISSING APPOINTMENTS:\n"));

      missingAppointments.forEach((apt, index) => {
        console.log(chalk.yellow(`${index + 1}. Appointment ID: ${apt.id}`));
        console.log(chalk.white(`   Name:     ${apt.firstName} ${apt.lastName}`));
        console.log(chalk.white(`   Email:    ${apt.email}`));
        console.log(chalk.white(`   Date:     ${apt.date}`));
        console.log(chalk.white(`   Time:     ${apt.time}`));
        console.log(chalk.white(`   Type:     ${apt.type}`));
        console.log(chalk.white(`   Type ID:  ${apt.appointmentTypeID}`));
        console.log(chalk.white(`   Calendar: ${apt.calendarID}`));
        console.log(chalk.gray(`   Datetime: ${apt.datetime}`));
        console.log("");
      });

      // Save to file option
      const saveToFile = await rl.question(
        chalk.cyan("\nWould you like to save the missing appointments to a file? (y/n): ")
      );

      if (saveToFile.toLowerCase() === "y") {
        const fs = await import("fs/promises");
        const filename = `missing-appointments-${year}-${month.toString().padStart(2, "0")}.json`;

        await fs.writeFile(
          filename,
          JSON.stringify(
            {
              month: `${year}-${month.toString().padStart(2, "0")}`,
              dateRange: { minDate, maxDate },
              summary: {
                totalAcuityAppointments: acuityAppointments.length,
                totalDatabaseBookings: dbBookings.length,
                bookingsWithAcuityId: dbAcuityIds.size,
                missingCount: missingAppointments.length,
              },
              missingAppointments: missingAppointments.map((apt) => ({
                id: apt.id,
                firstName: apt.firstName,
                lastName: apt.lastName,
                email: apt.email,
                phone: apt.phone,
                date: apt.date,
                time: apt.time,
                datetime: apt.datetime,
                type: apt.type,
                appointmentTypeID: apt.appointmentTypeID,
                calendarID: apt.calendarID,
                duration: apt.duration,
                price: apt.price,
                paid: apt.paid,
                amountPaid: apt.amountPaid,
              })),
            },
            null,
            2
          )
        );

        console.log(chalk.green(`\n✅ Saved to ${filename}`));
      }
    } else {
      console.log(chalk.green.bold("✅ All Acuity appointments are in the database!\n"));
    }

    // Additional statistics
    console.log(chalk.bold("\n" + "=".repeat(80)));
    console.log(chalk.bold.cyan("📈 ADDITIONAL STATISTICS"));
    console.log(chalk.bold("=".repeat(80) + "\n"));

    const bookingsWithoutAcuityId = dbBookings.filter((b) => b.acuity_appointment_id === null);
    console.log(
      chalk.white(`Bookings without Acuity ID: ${chalk.bold(bookingsWithoutAcuityId.length)}`)
    );

    if (bookingsWithoutAcuityId.length > 0) {
      console.log(chalk.gray("(These may be manually created bookings)"));
    }

    // Explain calendar vs database difference
    const difference = dbBookings.length - activeBookings.length;
    if (difference > 0) {
      console.log("");
      console.log(chalk.yellow("💡 Calendar View Explanation:"));
      console.log(
        chalk.white(
          `   The calendar shows ${chalk.bold.green(activeBookings.length)} bookings (${difference} fewer than database total)`
        )
      );
      console.log(chalk.gray("   because it filters to show only 'active' bookings by default."));
      console.log(chalk.gray("   The database includes 'closed' and 'archived' bookings."));
    }
    console.log("");

    // Group missing by appointment type
    if (missingAppointments.length > 0) {
      const byType = missingAppointments.reduce(
        (acc, apt) => {
          const key = `${apt.type} (ID: ${apt.appointmentTypeID})`;
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      console.log(chalk.yellow("\nMissing appointments by type:"));
      Object.entries(byType)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .forEach(([type, count]) => {
          console.log(chalk.white(`  ${type}: ${chalk.bold(count)}`));
        });
    }

    // Show cancelled appointments from Acuity for debugging
    if (cancelledAcuityAppointments.length > 0) {
      console.log(chalk.bold("\n" + "=".repeat(80)));
      console.log(chalk.bold.yellow("⚠️  CANCELLED/NO-SHOW APPOINTMENTS IN ACUITY"));
      console.log(chalk.bold("=".repeat(80) + "\n"));
      console.log(chalk.gray("These appointments are in the API but may not show in Acuity calendar UI:\n"));

      cancelledAcuityAppointments.forEach((apt: any, index: number) => {
        console.log(chalk.yellow(`${index + 1}. Appointment ID: ${apt.id}`));
        console.log(chalk.white(`   Name:     ${apt.firstName} ${apt.lastName}`));
        console.log(chalk.white(`   Email:    ${apt.email}`));
        console.log(chalk.white(`   Date:     ${apt.date} ${apt.time}`));
        console.log(chalk.white(`   Type:     ${apt.type}`));
        if (apt.canceled) {
          console.log(chalk.red(`   Status:   CANCELLED`));
        }
        if (apt.noShow) {
          console.log(chalk.red(`   Status:   NO-SHOW`));
        }
        console.log("");
      });
    }

    // Ask if user wants to sync missing appointments
    if (missingAppointments.length > 0 && DEFAULT_ORGANIZATION_ID && SYSTEM_USER_ID) {
      console.log(chalk.bold("\n" + "=".repeat(80)));
      console.log(chalk.bold.cyan("🔄 SYNC MISSING APPOINTMENTS"));
      console.log(chalk.bold("=".repeat(80) + "\n"));

      const shouldSync = await rl.question(
        chalk.cyan(`Would you like to sync ${missingAppointments.length} missing appointment(s) to the database? (y/n): `)
      );

      if (shouldSync.toLowerCase() === "y") {
        console.log(chalk.blue("\n🔄 Starting sync process...\n"));
        await syncMissingAppointments(db, missingAppointments, rl);
      }
    }

    console.log("");
  } catch (error: any) {
    console.error(chalk.red("\n❌ Error:"), error.message);
    if (error.stack) {
      console.error(chalk.gray(error.stack));
    }
  } finally {
    rl.close();
    await client.end();
  }
}

// ============================================================================
// SYNC FUNCTIONS
// ============================================================================

interface SyncStats {
  referrersCreated: number;
  examineesCreated: number;
  bookingsCreated: number;
  progressCreated: number;
  errors: number;
  skipped: number;
}

async function getOrCreateReferrer(
  db: any,
  appointment: any
): Promise<string | null> {
  const email = appointment.email?.toLowerCase().trim();
  const firstName = appointment.firstName;
  const lastName = appointment.lastName;

  if (!email || !firstName || !lastName) {
    console.log(chalk.yellow(`   ⚠️  Missing referrer data, skipping`));
    return null;
  }

  // Encrypt email for searching (encrypted fields can't be searched directly)
  // We'll create a new referrer each time to avoid encryption search issues
  // In production, you might want to maintain a separate index table for searching

  // Create new referrer with encrypted PII
  const referrerId = uuidv4();
  const phone = appointment.phone || "";

  await db.execute(sql`
    INSERT INTO referrers (
      id, organization_id, user_id, first_name, last_name, email, phone, job_title, created_at, updated_at
    )
    VALUES (
      ${referrerId},
      ${DEFAULT_ORGANIZATION_ID},
      NULL,
      ${encrypt(firstName)},
      ${encrypt(lastName)},
      ${encrypt(email)},
      ${encrypt(phone)},
      NULL,
      NOW(),
      NOW()
    )
  `);

  return referrerId;
}

async function createExaminee(
  db: any,
  appointment: any,
  referrerId: string
): Promise<string> {
  const email = appointment.email?.toLowerCase().trim() || "n/a";
  const firstName = appointment.firstName;
  const lastName = appointment.lastName;
  const phoneNumber = appointment.phone || "";
  const dateOfBirth = "1970-01-01"; // Placeholder - Acuity doesn't provide DOB
  const address = "Address not provided"; // Placeholder
  const condition = "Condition not provided"; // Placeholder
  const caseType = "General"; // Default case type

  // Note: Since examinees table uses encrypted columns, we cannot query by email to check for duplicates
  // We create a new examinee for each appointment from Acuity
  const examineeId = uuidv4();

  await db.execute(sql`
    INSERT INTO examinees (
      id, referrer_id, first_name, last_name, date_of_birth, address,
      email, phone_number, authorized_contact, condition, case_type, created_at, updated_at
    )
    VALUES (
      ${examineeId},
      ${referrerId},
      ${encrypt(firstName)},
      ${encrypt(lastName)},
      ${encrypt(dateOfBirth)},
      ${encrypt(address)},
      ${encrypt(email)},
      ${encrypt(phoneNumber)},
      ${true},
      ${encrypt(condition)},
      ${encrypt(caseType)},
      NOW(),
      NOW()
    )
  `);

  return examineeId;
}

async function createBooking(
  db: any,
  appointment: any,
  referrerId: string,
  examineeId: string,
  specialistId: string
): Promise<string> {
  const bookingId = uuidv4();
  const appointmentDateTime = new Date(appointment.datetime);
  const duration = parseInt(appointment.duration, 10) || 60;

  // Determine booking type
  const bookingType = appointment.type?.toLowerCase().includes("telehealth")
    ? "telehealth"
    : "in-person";

  await db.execute(sql`
    INSERT INTO bookings (
      id, organization_id, team_id, created_by_id, referrer_id, specialist_id, examinee_id,
      status, type, duration, location, date_time,
      acuity_appointment_id, acuity_appointment_type_id, acuity_calendar_id,
      scheduled_at, completed_at, cancelled_at, created_at, updated_at
    )
    VALUES (
      ${bookingId},
      ${DEFAULT_ORGANIZATION_ID},
      NULL,
      ${SYSTEM_USER_ID},
      ${referrerId},
      ${specialistId},
      ${examineeId},
      ${"active"},
      ${bookingType},
      ${duration},
      ${""},
      ${appointmentDateTime.toISOString()},
      ${appointment.id},
      ${appointment.appointmentTypeID},
      ${appointment.calendarID},
      ${appointmentDateTime.toISOString()},
      NULL,
      NULL,
      NOW(),
      NOW()
    )
  `);

  return bookingId;
}

async function createInitialProgress(db: any, bookingId: string): Promise<void> {
  const progressId = uuidv4();

  await db.execute(sql`
    INSERT INTO booking_progress (id, booking_id, from_status, to_status, changed_by, created_at)
    VALUES (${progressId}, ${bookingId}, NULL, ${"scheduled"}, ${SYSTEM_USER_ID}, NOW())
  `);
}

async function getSpecialistByCalendarId(db: any, calendarId: number): Promise<string | null> {
  const result = (await db.execute(sql`
    SELECT id FROM specialists WHERE acuity_calendar_id = ${calendarId} LIMIT 1
  `)) as { id: string }[];

  return result.length > 0 ? result[0].id : null;
}

async function syncMissingAppointments(db: any, appointments: any[], rl: any): Promise<void> {
  const stats: SyncStats = {
    referrersCreated: 0,
    examineesCreated: 0,
    bookingsCreated: 0,
    progressCreated: 0,
    errors: 0,
    skipped: 0,
  };

  for (let i = 0; i < appointments.length; i++) {
    const appointment = appointments[i];
    console.log(chalk.bold(`\n[${i + 1}/${appointments.length}] Appointment ${appointment.id}`));
    console.log(chalk.white(`   Name:     ${appointment.firstName} ${appointment.lastName}`));
    console.log(chalk.white(`   Email:    ${appointment.email}`));
    console.log(chalk.white(`   Date:     ${appointment.date} ${appointment.time}`));
    console.log(chalk.white(`   Type:     ${appointment.type}`));
    console.log(chalk.white(`   Duration: ${appointment.duration} min`));
    console.log(chalk.white(`   Calendar: ${appointment.calendarID}`));

    // Ask user if they want to sync this appointment
    const shouldSyncThis = await rl.question(
      chalk.cyan(`\n   Sync this appointment? (y/n/q to quit): `)
    );

    if (shouldSyncThis.toLowerCase() === "q") {
      console.log(chalk.yellow("\n⚠️  Sync cancelled by user"));
      break;
    }

    if (shouldSyncThis.toLowerCase() !== "y") {
      console.log(chalk.gray("   ⊘ Skipped"));
      stats.skipped++;
      continue;
    }

    console.log(chalk.blue("\n   🔄 Syncing..."));

    try {
      // Step 1: Get specialist by calendar ID
      const specialistId = await getSpecialistByCalendarId(db, appointment.calendarID);
      if (!specialistId) {
        console.log(chalk.yellow(`   ⚠️  Specialist not found for calendar ${appointment.calendarID}, skipping`));
        stats.errors++;
        continue;
      }
      console.log(chalk.gray(`   ✓ Specialist: ${specialistId}`));

      // Step 2: Get or create referrer
      const referrerId = await getOrCreateReferrer(db, appointment);
      if (!referrerId) {
        stats.errors++;
        continue;
      }
      console.log(chalk.gray(`   ✓ Referrer: ${referrerId}`));
      stats.referrersCreated++;

      // Step 3: Create examinee
      const examineeId = await createExaminee(db, appointment, referrerId);
      console.log(chalk.gray(`   ✓ Examinee: ${examineeId}`));
      stats.examineesCreated++;

      // Step 4: Create booking
      const bookingId = await createBooking(db, appointment, referrerId, examineeId, specialistId);
      console.log(chalk.gray(`   ✓ Booking: ${bookingId}`));
      stats.bookingsCreated++;

      // Step 5: Create initial progress
      await createInitialProgress(db, bookingId);
      console.log(chalk.gray(`   ✓ Progress: created`));
      stats.progressCreated++;

      console.log(chalk.green(`   ✅ Successfully synced appointment ${appointment.id}`));
    } catch (error: any) {
      console.log(chalk.red(`   ❌ Error syncing appointment ${appointment.id}: ${error.message}`));
      stats.errors++;
    }
  }

  // Display sync summary
  console.log(chalk.bold("\n" + "=".repeat(80)));
  console.log(chalk.bold.green("✅ SYNC COMPLETE"));
  console.log(chalk.bold("=".repeat(80) + "\n"));

  console.log(chalk.white(`Referrers created:  ${chalk.bold(stats.referrersCreated)}`));
  console.log(chalk.white(`Examinees created:  ${chalk.bold(stats.examineesCreated)}`));
  console.log(chalk.white(`Bookings created:   ${chalk.bold(stats.bookingsCreated)}`));
  console.log(chalk.white(`Progress created:   ${chalk.bold(stats.progressCreated)}`));

  if (stats.skipped > 0) {
    console.log(chalk.yellow(`Skipped:            ${chalk.bold(stats.skipped)}`));
  }

  if (stats.errors > 0) {
    console.log(chalk.red(`Errors:             ${chalk.bold(stats.errors)}`));
  }

  console.log("");
}

// Run the checker
checkMissingAppointments().catch(console.error);
