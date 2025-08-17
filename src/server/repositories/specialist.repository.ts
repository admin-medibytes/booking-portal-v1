import { db } from "@/server/db";
import { specialists, users } from "@/server/db/schema";
import { eq, sql } from "drizzle-orm";
import { type } from "arktype";

// Input validation schemas
export const CreateSpecialistInput = type({
  userId: "string",
  acuityCalendarId: "string",
  name: "string",
  specialty: "string",
  location: "string | null | undefined",
  isActive: "boolean | undefined",
});

export const UpdateSpecialistInput = type({
  name: "string | undefined",
  specialty: "string | undefined",
  location: "string | null | undefined",
  isActive: "boolean | undefined",
});

export type CreateSpecialistInputType = typeof CreateSpecialistInput.infer;
export type UpdateSpecialistInputType = typeof UpdateSpecialistInput.infer;

export class SpecialistRepository {
  // Create a new specialist
  async create(data: CreateSpecialistInputType) {
    const validated = CreateSpecialistInput(data);
    if (validated instanceof type.errors) {
      throw new Error(`Invalid specialist data: ${validated[0]?.message}`);
    }

    const [specialist] = await db
      .insert(specialists)
      .values({
        userId: validated.userId,
        acuityCalendarId: validated.acuityCalendarId,
        name: validated.name,
        specialty: validated.specialty,
        location: validated.location ?? null,
        isActive: validated.isActive ?? true,
      })
      .returning();

    return specialist;
  }

  // Update an existing specialist
  async update(id: string, data: UpdateSpecialistInputType) {
    const validated = UpdateSpecialistInput(data);
    if (validated instanceof type.errors) {
      throw new Error(`Invalid update data: ${validated[0]?.message}`);
    }

    // Build update object dynamically
    const updateData: Partial<{
      name: string;
      specialty: string;
      location: string | null;
      isActive: boolean;
      updatedAt: Date;
    }> = {};
    if (validated.name !== undefined) updateData.name = validated.name;
    if (validated.specialty !== undefined) updateData.specialty = validated.specialty;
    if (validated.location !== undefined) updateData.location = validated.location;
    if (validated.isActive !== undefined) updateData.isActive = validated.isActive;

    // Always update the updatedAt timestamp
    updateData.updatedAt = new Date();

    const [specialist] = await db
      .update(specialists)
      .set(updateData)
      .where(eq(specialists.id, id))
      .returning();

    return specialist;
  }

  // Find specialist by user ID
  async findByUserId(userId: string) {
    const result = await db
      .select({
        specialist: specialists,
        user: users,
      })
      .from(specialists)
      .innerJoin(users, eq(specialists.userId, users.id))
      .where(eq(specialists.userId, userId))
      .limit(1);

    return result[0] || null;
  }

  // Find specialist by Acuity calendar ID
  async findByAcuityCalendarId(acuityCalendarId: string) {
    const result = await db
      .select({
        specialist: specialists,
        user: users,
      })
      .from(specialists)
      .innerJoin(users, eq(specialists.userId, users.id))
      .where(eq(specialists.acuityCalendarId, acuityCalendarId))
      .limit(1);

    return result[0] || null;
  }

  // Find specialist by ID
  async findById(id: string) {
    const result = await db
      .select({
        specialist: specialists,
        user: users,
      })
      .from(specialists)
      .innerJoin(users, eq(specialists.userId, users.id))
      .where(eq(specialists.id, id))
      .limit(1);

    return result[0] || null;
  }

  // Get all active specialists
  async findAllActive() {
    const results = await db
      .select({
        specialist: specialists,
        user: users,
      })
      .from(specialists)
      .innerJoin(users, eq(specialists.userId, users.id))
      .where(eq(specialists.isActive, true))
      .orderBy(specialists.name);

    return results;
  }

  // Get all specialists (active and inactive)
  async findAll() {
    const results = await db
      .select({
        specialist: specialists,
        user: users,
      })
      .from(specialists)
      .innerJoin(users, eq(specialists.userId, users.id))
      .orderBy(specialists.name);

    return results;
  }

  // Check if a user is already a specialist
  async isUserSpecialist(userId: string): Promise<boolean> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(specialists)
      .where(eq(specialists.userId, userId));

    return result.count > 0;
  }

  // Check if an Acuity calendar is already linked
  async isCalendarLinked(acuityCalendarId: string): Promise<boolean> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(specialists)
      .where(eq(specialists.acuityCalendarId, acuityCalendarId));

    return result.count > 0;
  }

  // Deactivate a specialist
  async deactivate(id: string) {
    const [specialist] = await db
      .update(specialists)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(specialists.id, id))
      .returning();

    return specialist;
  }

  // Activate a specialist
  async activate(id: string) {
    const [specialist] = await db
      .update(specialists)
      .set({
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(specialists.id, id))
      .returning();

    return specialist;
  }
}

// Singleton instance
export const specialistRepository = new SpecialistRepository();