#!/usr/bin/env tsx
import { createInterface } from "readline/promises";
import { stdin as input, stdout as output } from "process";
import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import * as schema from "@/server/db/schema";
import { eq, and, sql } from "drizzle-orm";
import chalk from "chalk";

const DB_URL = process.env.DATABASE_URL;

// Validate environment variables
if (!DB_URL) {
  throw new Error("❌ DATABASE_URL environment variable is required");
}

// Database connection
const dbClient: Sql = postgres(DB_URL);
const db = drizzle(dbClient, { schema });

const { referrers, bookings, examinees, specialists, users } = schema;

const rl = createInterface({ input, output });

async function listReferrerBookings() {
  console.log(chalk.blue("\n📋 List Referrer Bookings by Email\n"));

  try {
    // Ask for referrer email
    const email = await rl.question("Enter referrer email: ");

    if (!email || !email.trim()) {
      console.log(chalk.red("❌ Email is required"));
      process.exit(1);
    }

    const trimmedEmail = email.trim();

    // Find referrer records (case-insensitive)
    console.log(chalk.yellow("\n🔍 Searching for referrer records..."));
    const referrerRecords = await db
      .select({
        id: referrers.id,
        firstName: referrers.firstName,
        lastName: referrers.lastName,
        email: referrers.email,
        userId: referrers.userId,
        organizationId: referrers.organizationId,
        createdAt: referrers.createdAt,
      })
      .from(referrers)
      .where(sql`LOWER(${referrers.email}) = LOWER(${trimmedEmail})`);

    if (referrerRecords.length === 0) {
      console.log(chalk.yellow(`\n⚠️  No referrer records found for ${trimmedEmail}`));
      console.log(chalk.dim("This email has no associated referrer records."));
      process.exit(0);
    }

    console.log(chalk.green(`\n✅ Found ${referrerRecords.length} referrer record(s) for ${trimmedEmail}\n`));

    // Display referrer records
    referrerRecords.forEach((ref, index) => {
      console.log(chalk.cyan(`${index + 1}. ${ref.firstName} ${ref.lastName}`));
      console.log(chalk.dim(`   Referrer ID: ${ref.id}`));
      console.log(chalk.dim(`   User ID: ${ref.userId || "Not linked to user account"}`));
      console.log(chalk.dim(`   Organization ID: ${ref.organizationId}`));
      console.log(chalk.dim(`   Created: ${ref.createdAt.toISOString()}`));
      console.log("");
    });

    // Get all referrer IDs
    const referrerIds = referrerRecords.map((r) => r.id);

    // Find all bookings for these referrers
    console.log(chalk.yellow("🔍 Searching for bookings...\n"));

    const bookingRecords = await db
      .select({
        bookingId: bookings.id,
        acuityAppointmentId: bookings.acuityAppointmentId,
        type: bookings.type,
        status: bookings.status,
        dateTime: bookings.dateTime,
        createdAt: bookings.createdAt,
        referrerId: bookings.referrerId,
        referrerFirstName: referrers.firstName,
        referrerLastName: referrers.lastName,
        examineeFirstName: examinees.firstName,
        examineeLastName: examinees.lastName,
        specialistFirstName: users.firstName,
        specialistLastName: users.lastName,
        organizationId: bookings.organizationId,
      })
      .from(bookings)
      .innerJoin(referrers, eq(bookings.referrerId, referrers.id))
      .innerJoin(examinees, eq(bookings.examineeId, examinees.id))
      .innerJoin(specialists, eq(bookings.specialistId, specialists.id))
      .innerJoin(users, eq(specialists.userId, users.id))
      .where(sql`${bookings.referrerId} IN (${sql.join(referrerIds.map((id) => sql`${id}`), sql`, `)})`);

    if (bookingRecords.length === 0) {
      console.log(chalk.yellow(`⚠️  No bookings found for this referrer`));
      console.log(chalk.dim("This referrer has no associated bookings."));
    } else {
      console.log(chalk.green(`✅ Found ${bookingRecords.length} booking(s)\n`));
      console.log(chalk.cyan("=" + "=".repeat(79)));
      console.log(chalk.cyan("Acuity Appointment IDs:"));
      console.log(chalk.cyan("=" + "=".repeat(79)) + "\n");

      bookingRecords.forEach((booking, index) => {
        console.log(chalk.white(`${index + 1}. Acuity Appointment ID: ${chalk.bold(booking.acuityAppointmentId)}`));
        // console.log(chalk.dim(`   Booking ID: ${booking.bookingId}`));
        // console.log(chalk.dim(`   Referrer: ${booking.referrerFirstName} ${booking.referrerLastName}`));
        // console.log(chalk.dim(`   Examinee: ${booking.examineeFirstName} ${booking.examineeLastName}`));
        // console.log(chalk.dim(`   Specialist: ${booking.specialistFirstName} ${booking.specialistLastName}`));
        // console.log(chalk.dim(`   Type: ${booking.type}`));
        // console.log(chalk.dim(`   Status: ${booking.status}`));
        // console.log(
        //   chalk.dim(`   Date/Time: ${booking.dateTime ? booking.dateTime.toISOString() : "Not scheduled"}`)
        // );
        // console.log(chalk.dim(`   Created: ${booking.createdAt.toISOString()}`));
        // console.log("");
      });

      console.log(chalk.cyan("=" + "=".repeat(79)));
      console.log(chalk.green("\n✅ Summary:"));
      console.log(`   Total bookings: ${bookingRecords.length}`);
      console.log(`   Acuity Appointment IDs: ${bookingRecords.map((b) => b.acuityAppointmentId).join(", ")}`);
    }
  } catch (error: any) {
    console.error(chalk.red("\n❌ Error:"), error.message);
    console.error(error);
  } finally {
    rl.close();
    await dbClient.end();
  }
}

// Run the script
listReferrerBookings()
  .then(() => {
    console.log();
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Fatal error:", error);
    process.exit(1);
  });
