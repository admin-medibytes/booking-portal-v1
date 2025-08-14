import { db } from "./index";
import { users, organizations, members } from "./schema";
import { auth } from "@/lib/auth";
import crypto from "crypto";

async function seed() {
  console.log("🌱 Starting database seed...");

  try {
    // Create a default organization
    const [org] = await db
      .insert(organizations)
      .values({
        id: crypto.randomUUID(),
        name: "Medibytes Admin Org",
        slug: "medibytes-admin",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    console.log("✅ Created organization:", org.name);

    // Create admin user using Better Auth
    const result = await auth.api.createUser({
      headers: new Headers(),
      body: {
        email: "admin@medibytes.com",
        password: "Admin123!@#", // Change this!
        name: "System Admin",
        role: "admin",
      },
    });

    if (result?.user) {
      console.log("✅ Created admin user:", result.user.email);
      
      // Add user to organization as owner
      await db.insert(members).values({
        id: crypto.randomUUID(),
        userId: result.user.id,
        organizationId: org.id,
        role: "owner",
        createdAt: new Date(),
      });

      console.log("✅ Added admin to organization as owner");
      
      console.log("\n🎉 Seed completed successfully!");
      console.log("\n📧 Login credentials:");
      console.log("   Email: admin@medibytes.com");
      console.log("   Password: Admin123!@#");
      console.log("\n⚠️  IMPORTANT: Change the password after first login!");
    }
  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  }

  process.exit(0);
}

// Run seed
seed();