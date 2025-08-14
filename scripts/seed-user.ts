#!/usr/bin/env tsx
import { createInterface } from "readline/promises";
import { stdin as input, stdout as output } from "process";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  users,
  organizations,
  members,
  teams,
  teamMembers,
  accounts,
} from "@/server/db/schema/auth";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { hashPassword } from "@/lib/crypto";
import chalk from "chalk";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

// Create database connection
const client = postgres(
  process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/booking_portal"
);
const db = drizzle(client);

const rl = createInterface({ input, output });

async function seedUser() {
  console.log(chalk.blue("\n🌱 Database User Seeder\n"));

  try {
    // Get user details
    const firstName = await rl.question("First Name: ");
    const lastName = await rl.question("Last Name: ");
    const email = await rl.question("Email: ");
    const jobTitle = await rl.question("Job Title: ");
    const password = await rl.question("Password (min 8 chars): ");

    // Validate password
    if (password.length < 8) {
      console.log(chalk.red("❌ Password must be at least 8 characters"));
      process.exit(1);
    }

    // Select role
    console.log("\nSelect user role:");
    console.log("1. admin");
    console.log("2. user");
    const roleChoice = await rl.question("Enter choice (1-2): ");
    const role = roleChoice === "1" ? "admin" : "user";

    // Organization setup
    console.log("\n" + chalk.yellow("Organization Setup"));
    const existingOrgs = await db.select().from(organizations);

    let orgId: string;
    if (existingOrgs.length > 0) {
      console.log("\nExisting organizations:");
      existingOrgs.forEach((org, index) => {
        console.log(`${index + 1}. ${org.name}`);
      });
      console.log(`${existingOrgs.length + 1}. Create new organization`);

      const orgChoice = await rl.question(`Select (1-${existingOrgs.length + 1}): `);
      const orgIndex = parseInt(orgChoice) - 1;

      if (orgIndex === existingOrgs.length) {
        // Create new org
        const orgName = await rl.question("Organization name: ");
        const orgSlug = await rl.question("Organization slug: ");

        const [newOrg] = await db
          .insert(organizations)
          .values({
            id: crypto.randomUUID(),
            name: orgName,
            slug: orgSlug,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        orgId = newOrg.id;
        console.log(chalk.green(`✅ Created organization: ${orgName}`));
      } else {
        orgId = existingOrgs[orgIndex].id;
      }
    } else {
      // Create first org
      const orgName = await rl.question("Organization name: ");
      const orgSlug = await rl.question("Organization slug: ");

      const [newOrg] = await db
        .insert(organizations)
        .values({
          id: crypto.randomUUID(),
          name: orgName,
          slug: orgSlug,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      orgId = newOrg.id;
      console.log(chalk.green(`✅ Created organization: ${orgName}`));
    }

    // Member role
    console.log("\n" + chalk.yellow("Organization Member Role"));
    console.log("1. owner");
    console.log("2. manager");
    console.log("3. team_lead");
    console.log("4. referrer");
    console.log("5. specialist");
    const memberRoleChoice = await rl.question("Select (1-5): ");
    const memberRoles = ["owner", "manager", "team_lead", "referrer", "specialist"];
    const memberRole = memberRoles[parseInt(memberRoleChoice) - 1] || "referrer";

    // Team setup
    console.log("\n" + chalk.yellow("Team Setup"));
    const existingTeams = await db.select().from(teams).where(eq(teams.organizationId, orgId));

    let teamId: string | null = null;
    if (existingTeams.length > 0) {
      console.log("\nExisting teams:");
      existingTeams.forEach((team, index) => {
        console.log(`${index + 1}. ${team.name}`);
      });
      console.log(`${existingTeams.length + 1}. Create new team`);
      console.log(`${existingTeams.length + 2}. No team`);

      const teamChoice = await rl.question(`Select (1-${existingTeams.length + 2}): `);
      const teamIndex = parseInt(teamChoice) - 1;

      if (teamIndex === existingTeams.length) {
        // Create new team
        const teamName = await rl.question("Team name: ");

        const [newTeam] = await db
          .insert(teams)
          .values({
            id: crypto.randomUUID(),
            name: teamName,
            organizationId: orgId,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        teamId = newTeam.id;
        console.log(chalk.green(`✅ Created team: ${teamName}`));
      } else if (teamIndex < existingTeams.length) {
        teamId = existingTeams[teamIndex].id;
      }
    } else {
      const createTeam = await rl.question("Create a team? (y/n): ");
      if (createTeam.toLowerCase() === "y") {
        const teamName = await rl.question("Team name: ");

        const [newTeam] = await db
          .insert(teams)
          .values({
            id: crypto.randomUUID(),
            name: teamName,
            organizationId: orgId,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        teamId = newTeam.id;
        console.log(chalk.green(`✅ Created team: ${teamName}`));
      }
    }

    // Create user
    console.log("\n" + chalk.blue("Creating user..."));

    const userId = crypto.randomUUID();
    const hashedPassword = await hashPassword(password);

    // Insert user
    await db.insert(users).values({
      id: userId,
      email,
      name: `${firstName} ${lastName}`,
      firstName,
      lastName,
      jobTitle,
      emailVerified: true,
      role: role as "admin" | "user",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create account for password login
    await db.insert(accounts).values({
      id: crypto.randomUUID(),
      userId,
      accountId: email,
      providerId: "credential",
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Add to organization
    await db.insert(members).values({
      id: crypto.randomUUID(),
      userId,
      organizationId: orgId,
      role: memberRole as any,
      createdAt: new Date(),
    });

    // Add to team if selected
    if (teamId) {
      await db.insert(teamMembers).values({
        id: crypto.randomUUID(),
        teamId,
        userId,
        createdAt: new Date(),
      });
    }

    console.log(chalk.green("\n✅ User created successfully!"));
    console.log(chalk.cyan("\nUser Details:"));
    console.log(`  Name: ${firstName} ${lastName}`);
    console.log(`  Email: ${email}`);
    console.log(`  Role: ${role}`);
    console.log(`  Member Role: ${memberRole}`);
    console.log(`  Team: ${teamId ? "Assigned" : "None"}`);

    console.log(chalk.yellow("\n🔐 Login with these credentials:"));
    console.log(`  Email: ${email}`);
    console.log(`  Password: [the password you entered]`);
  } catch (error: any) {
    console.error(chalk.red("\n❌ Error:"), error.message);
  } finally {
    rl.close();
    await client.end();
  }
}

// Run the seeder
seedUser().catch(console.error);
