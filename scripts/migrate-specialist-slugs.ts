#!/usr/bin/env tsx
import { db } from "@/server/db";
import { specialists } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { generateSlug } from "@/lib/utils/slug";

async function migrateSpecialistSlugs() {
  console.log("Starting specialist slug migration...");

  try {
    // Get all specialists without slugs
    const allSpecialists = await db.select().from(specialists);
    
    console.log(`Found ${allSpecialists.length} specialists to migrate`);

    // Track used slugs to ensure uniqueness
    const usedSlugs = new Set<string>();

    for (const specialist of allSpecialists) {
      // Skip if already has a slug
      if (specialist.slug) {
        usedSlugs.add(specialist.slug);
        console.log(`Skipping ${specialist.name} - already has slug: ${specialist.slug}`);
        continue;
      }

      // Generate slug from name
      let baseSlug = generateSlug(specialist.name);
      let slug = baseSlug;
      let counter = 1;

      // Ensure uniqueness
      while (usedSlugs.has(slug)) {
        counter++;
        slug = `${baseSlug}-${counter}`;
      }

      usedSlugs.add(slug);

      // Update the specialist with the new slug
      await db
        .update(specialists)
        .set({ slug, updatedAt: new Date() })
        .where(eq(specialists.id, specialist.id));

      console.log(`✓ Updated ${specialist.name} with slug: ${slug}`);
    }

    console.log("✅ Migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

// Run the migration
migrateSpecialistSlugs()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Unexpected error:", error);
    process.exit(1);
  });