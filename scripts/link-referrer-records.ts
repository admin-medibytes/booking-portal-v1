#!/usr/bin/env tsx
import { createInterface } from "readline/promises";
import { stdin as input, stdout as output } from "process";
import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import * as schema from "@/server/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import chalk from "chalk";

const DB_URL = process.env.DATABASE_URL;

// Validate environment variables
if (!DB_URL) {
  throw new Error("❌ DATABASE_URL environment variable is required");
}

// Database connection
const dbClient: Sql = postgres(DB_URL);
const db = drizzle(dbClient, { schema });

const { users, referrers } = schema;

const rl = createInterface({ input, output });

async function linkReferrerRecords() {
  console.log(chalk.blue("\n🔗 Link Orphaned Referrer Records to User\n"));

  try {
    // Ask for user email
    const email = await rl.question("Enter user email: ");

    if (!email || !email.trim()) {
      console.log(chalk.red("❌ Email is required"));
      process.exit(1);
    }

    const trimmedEmail = email.trim();

    // Find the user (case-insensitive)
    console.log(chalk.yellow("\n🔍 Searching for user..."));
    const user = await db.query.users.findFirst({
      where: sql`LOWER(${users.email}) = LOWER(${trimmedEmail})`,
      columns: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!user) {
      console.log(chalk.red(`❌ No user found with email: ${trimmedEmail}`));
      process.exit(1);
    }

    console.log(chalk.green(`✅ Found user: ${user.firstName} ${user.lastName} (${user.email})`));

    // Find orphaned referrer records (case-insensitive email match)
    console.log(chalk.yellow("\n🔍 Searching for orphaned referrer records..."));
    const orphanedReferrers = await db
      .select({
        id: referrers.id,
        firstName: referrers.firstName,
        lastName: referrers.lastName,
        email: referrers.email,
        organizationId: referrers.organizationId,
        createdAt: referrers.createdAt,
      })
      .from(referrers)
      .where(
        and(
          sql`LOWER(${referrers.email}) = LOWER(${user.email})`,
          sql`${referrers.userId} IS NULL`
        )
      );

    if (orphanedReferrers.length === 0) {
      console.log(chalk.yellow(`\n⚠️  No orphaned referrer records found for ${user.email}`));
      console.log(chalk.dim("This user has no unlinked referrer records."));
      process.exit(0);
    }

    // Display found records
    console.log(chalk.cyan(`\n📋 Found ${orphanedReferrers.length} orphaned referrer record(s):\n`));
    orphanedReferrers.forEach((ref, index) => {
      console.log(chalk.white(`  ${index + 1}. ${ref.firstName} ${ref.lastName}`));
      console.log(chalk.dim(`     Email: ${ref.email}`));
      console.log(chalk.dim(`     Organization ID: ${ref.organizationId}`));
      console.log(chalk.dim(`     Created: ${ref.createdAt.toISOString()}`));
      console.log("");
    });

    // Ask for confirmation
    const confirm = await rl.question(
      chalk.yellow(`\n⚠️  Link these ${orphanedReferrers.length} record(s) to user ${user.email}? (yes/no): `)
    );

    if (confirm.toLowerCase() !== "yes" && confirm.toLowerCase() !== "y") {
      console.log(chalk.red("\n❌ Operation cancelled"));
      process.exit(0);
    }

    // Perform the linking
    console.log(chalk.blue("\n🔗 Linking records..."));
    const referrerIds = orphanedReferrers.map((r) => r.id);

    await db
      .update(referrers)
      .set({
        userId: user.id,
        updatedAt: new Date(),
      })
      .where(inArray(referrers.id, referrerIds));

    console.log(chalk.green(`\n✅ Successfully linked ${orphanedReferrers.length} referrer record(s) to user!`));
    console.log(chalk.cyan("\nSummary:"));
    console.log(`  User: ${user.firstName} ${user.lastName} (${user.email})`);
    console.log(`  User ID: ${user.id}`);
    console.log(`  Records linked: ${orphanedReferrers.length}`);
  } catch (error: any) {
    console.error(chalk.red("\n❌ Error:"), error.message);
    console.error(error);
  } finally {
    rl.close();
    await dbClient.end();
  }
}

// Run the script
linkReferrerRecords()
  .then(() => {
    console.log();
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Fatal error:", error);
    process.exit(1);
  });
