#!/usr/bin/env tsx
import { createInterface } from "readline/promises";
import { stdin as input, stdout as output } from "process";
import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import * as schema from "@/server/db/schema";
import { eq, inArray } from "drizzle-orm";
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

async function unlinkReferrerRecords() {
  console.log(chalk.blue("\n🔓 Unlink Referrer Records from User\n"));

  try {
    // Ask for user ID
    const userId = await rl.question("Enter user ID: ");

    if (!userId || !userId.trim()) {
      console.log(chalk.red("❌ User ID is required"));
      process.exit(1);
    }

    const trimmedUserId = userId.trim();

    // Find the user
    console.log(chalk.yellow("\n🔍 Searching for user..."));
    const user = await db.query.users.findFirst({
      where: eq(users.id, trimmedUserId),
      columns: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!user) {
      console.log(chalk.red(`❌ No user found with ID: ${trimmedUserId}`));
      process.exit(1);
    }

    console.log(chalk.green(`✅ Found user: ${user.firstName} ${user.lastName} (${user.email})`));

    // Find linked referrer records
    console.log(chalk.yellow("\n🔍 Searching for linked referrer records..."));
    const linkedReferrers = await db
      .select({
        id: referrers.id,
        firstName: referrers.firstName,
        lastName: referrers.lastName,
        email: referrers.email,
        organizationId: referrers.organizationId,
        createdAt: referrers.createdAt,
      })
      .from(referrers)
      .where(eq(referrers.userId, user.id));

    if (linkedReferrers.length === 0) {
      console.log(chalk.yellow(`\n⚠️  No linked referrer records found for user ${user.email}`));
      console.log(chalk.dim("This user has no referrer records to unlink."));
      process.exit(0);
    }

    // Display found records
    console.log(chalk.cyan(`\n📋 Found ${linkedReferrers.length} linked referrer record(s):\n`));
    linkedReferrers.forEach((ref, index) => {
      console.log(chalk.white(`  ${index + 1}. ${ref.firstName} ${ref.lastName}`));
      console.log(chalk.dim(`     Email: ${ref.email}`));
      console.log(chalk.dim(`     Organization ID: ${ref.organizationId}`));
      console.log(chalk.dim(`     Created: ${ref.createdAt.toISOString()}`));
      console.log("");
    });

    // Ask for confirmation
    const confirm = await rl.question(
      chalk.yellow(`\n⚠️  Unlink these ${linkedReferrers.length} record(s) from user ${user.email}? (yes/no): `)
    );

    if (confirm.toLowerCase() !== "yes" && confirm.toLowerCase() !== "y") {
      console.log(chalk.red("\n❌ Operation cancelled"));
      process.exit(0);
    }

    // Perform the unlinking
    console.log(chalk.blue("\n🔓 Unlinking records..."));
    const referrerIds = linkedReferrers.map((r) => r.id);

    await db
      .update(referrers)
      .set({
        userId: null,
        updatedAt: new Date(),
      })
      .where(inArray(referrers.id, referrerIds));

    console.log(chalk.green(`\n✅ Successfully unlinked ${linkedReferrers.length} referrer record(s) from user!`));
    console.log(chalk.cyan("\nSummary:"));
    console.log(`  User: ${user.firstName} ${user.lastName} (${user.email})`);
    console.log(`  User ID: ${user.id}`);
    console.log(`  Records unlinked: ${linkedReferrers.length}`);
  } catch (error: any) {
    console.error(chalk.red("\n❌ Error:"), error.message);
    console.error(error);
  } finally {
    rl.close();
    await dbClient.end();
  }
}

// Run the script
unlinkReferrerRecords()
  .then(() => {
    console.log();
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Fatal error:", error);
    process.exit(1);
  });
