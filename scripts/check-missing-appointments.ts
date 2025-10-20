#!/usr/bin/env tsx
import { createInterface } from "readline/promises";
import { stdin as input, stdout as output } from "process";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { and, gte, lte, sql } from "drizzle-orm";
import chalk from "chalk";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

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
    const dbBookings = await db.execute<{
      id: string;
      acuity_appointment_id: number | null;
      date_time: Date;
      status: string;
    }>(sql`
      SELECT id, acuity_appointment_id, date_time, status
      FROM bookings
      WHERE date_time >= ${startDate.toISOString()}
        AND date_time <= ${endDate.toISOString()}
    `);
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

// Run the checker
checkMissingAppointments().catch(console.error);
