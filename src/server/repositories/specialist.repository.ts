import { db } from "@/server/db";
import { specialists, users, specialistAppointmentTypes, type SpecialistLocation } from "@/server/db/schema";
import { eq, sql, asc, and, or } from "drizzle-orm";
import { type } from "arktype";

// Location validation schema
export const LocationInput = type({
  streetAddress: "string | undefined",
  suburb: "string | undefined",
  city: "string",
  state: "string",
  postalCode: "string | undefined",
  country: "string",
});

// Input validation schemas
export const CreateSpecialistInput = type({
  userId: "string",
  acuityCalendarId: "string",
  name: "string",
  slug: "string",
  location: LocationInput.or("null | undefined"),
  isActive: "boolean | undefined",
});

export const UpdateSpecialistInput = type({
  name: "string | undefined",
  slug: "string | undefined | null",
  image: "string | null | undefined",
  location: LocationInput.or("null | undefined"),
  isActive: "boolean | undefined",
});

export const UpdatePositionsInput = type({
  id: "string",
  position: "number",
}).array();

export type CreateSpecialistInputType = typeof CreateSpecialistInput.infer;
export type UpdateSpecialistInputType = typeof UpdateSpecialistInput.infer;
export type UpdatePositionsInputType = typeof UpdatePositionsInput.infer;

export class SpecialistRepository {
  // Get the highest position value
  async getMaxPosition(): Promise<number> {
    const result = await db
      .select({ maxPosition: sql<number>`COALESCE(MAX(position), 0)` })
      .from(specialists);

    return result[0]?.maxPosition ?? 0;
  }

  // Create a new specialist
  async create(data: CreateSpecialistInputType) {
    const validated = CreateSpecialistInput(data);
    if (validated instanceof type.errors) {
      throw new Error(`Invalid specialist data: ${validated[0]?.message}`);
    }

    // Get the next position
    const maxPosition = await this.getMaxPosition();
    const position = maxPosition + 1;

    const [specialist] = await db
      .insert(specialists)
      .values({
        userId: validated.userId,
        acuityCalendarId: validated.acuityCalendarId,
        name: validated.name,
        slug: validated.slug,
        location: (validated.location as SpecialistLocation | null) ?? null,
        position,
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
      slug: string | null;
      image: string | null;
      location: SpecialistLocation | null;
      isActive: boolean;
      updatedAt: Date;
    }> = {};
    if (validated.name !== undefined) updateData.name = validated.name;
    if (validated.slug !== undefined) updateData.slug = validated.slug;
    if (validated.image !== undefined) updateData.image = validated.image;
    if (validated.location !== undefined)
      updateData.location = validated.location as SpecialistLocation | null;
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
        user: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          jobTitle: users.jobTitle,
        },
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
        user: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          jobTitle: users.jobTitle,
        },
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
        user: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          jobTitle: users.jobTitle,
        },
        // Computed fields based on appointment types
        hasInPersonAppointments: sql<boolean>`EXISTS (
          SELECT 1 FROM ${specialistAppointmentTypes} 
          WHERE ${specialistAppointmentTypes.specialistId} = ${specialists.id}
          AND ${specialistAppointmentTypes.enabled} = true
          AND ${specialistAppointmentTypes.appointmentMode} = 'in-person'
        )`,
        hasTelehealthAppointments: sql<boolean>`EXISTS (
          SELECT 1 FROM ${specialistAppointmentTypes}
          WHERE ${specialistAppointmentTypes.specialistId} = ${specialists.id}
          AND ${specialistAppointmentTypes.enabled} = true
          AND ${specialistAppointmentTypes.appointmentMode} = 'telehealth'
        )`,
      })
      .from(specialists)
      .innerJoin(users, eq(specialists.userId, users.id))
      .where(eq(specialists.id, id))
      .limit(1);

    if (!result[0]) return null;

    // Add computed fields to specialist
    const specialist = {
      ...result[0].specialist,
      acceptsInPerson: result[0].hasInPersonAppointments,
      acceptsTelehealth: result[0].hasTelehealthAppointments,
    };

    return { specialist, user: result[0].user };
  }

  // Get all active specialists
  async findAllActive() {
    const results = await db
      .select({
        specialist: specialists,
        user: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          jobTitle: users.jobTitle,
        },
        // Computed fields based on appointment types
        hasInPersonAppointments: sql<boolean>`EXISTS (
          SELECT 1 FROM ${specialistAppointmentTypes} 
          WHERE ${specialistAppointmentTypes.specialistId} = ${specialists.id}
          AND ${specialistAppointmentTypes.enabled} = true
          AND ${specialistAppointmentTypes.appointmentMode} = 'in-person'
        )`,
        hasTelehealthAppointments: sql<boolean>`EXISTS (
          SELECT 1 FROM ${specialistAppointmentTypes}
          WHERE ${specialistAppointmentTypes.specialistId} = ${specialists.id}
          AND ${specialistAppointmentTypes.enabled} = true
          AND ${specialistAppointmentTypes.appointmentMode} = 'telehealth'
        )`,
      })
      .from(specialists)
      .innerJoin(users, eq(specialists.userId, users.id))
      .where(eq(specialists.isActive, true))
      .orderBy(asc(specialists.position));

    return results.map(r => ({
      specialist: {
        ...r.specialist,
        acceptsInPerson: r.hasInPersonAppointments,
        acceptsTelehealth: r.hasTelehealthAppointments,
      },
      user: r.user,
    }));
  }

  // Get all specialists (active and inactive)
  async findAll() {
    const results = await db
      .select({
        specialist: specialists,
        user: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          jobTitle: users.jobTitle,
        },
        // Computed fields based on appointment types
        hasInPersonAppointments: sql<boolean>`EXISTS (
          SELECT 1 FROM ${specialistAppointmentTypes} 
          WHERE ${specialistAppointmentTypes.specialistId} = ${specialists.id}
          AND ${specialistAppointmentTypes.enabled} = true
          AND ${specialistAppointmentTypes.appointmentMode} = 'in-person'
        )`,
        hasTelehealthAppointments: sql<boolean>`EXISTS (
          SELECT 1 FROM ${specialistAppointmentTypes}
          WHERE ${specialistAppointmentTypes.specialistId} = ${specialists.id}
          AND ${specialistAppointmentTypes.enabled} = true
          AND ${specialistAppointmentTypes.appointmentMode} = 'telehealth'
        )`,
      })
      .from(specialists)
      .innerJoin(users, eq(specialists.userId, users.id))
      .orderBy(asc(specialists.position));

    return results.map(r => ({
      specialist: {
        ...r.specialist,
        acceptsInPerson: r.hasInPersonAppointments,
        acceptsTelehealth: r.hasTelehealthAppointments,
      },
      user: r.user,
    }));
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

  // Find specialist by slug
  async findBySlug(slug: string) {
    const result = await db
      .select({
        specialist: specialists,
        user: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          jobTitle: users.jobTitle,
        },
      })
      .from(specialists)
      .innerJoin(users, eq(specialists.userId, users.id))
      .where(eq(specialists.slug, slug));

    return result[0] || null;
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

  // Bulk update positions (for drag-and-drop reordering)
  async updatePositions(updates: UpdatePositionsInputType) {
    const validated = UpdatePositionsInput(updates);
    if (validated instanceof type.errors) {
      throw new Error(`Invalid position update data: ${validated[0]?.message}`);
    }

    // Use a transaction to ensure atomicity
    return await db.transaction(async (tx) => {
      try {
        // First, verify all specialists exist
        const specialistIds = validated.map((u) => u.id);
        const existingSpecialists = await tx
          .select({ id: specialists.id })
          .from(specialists)
          .where(sql`${specialists.id} IN ${specialistIds}`);

        if (existingSpecialists.length !== specialistIds.length) {
          throw new Error("One or more specialists not found");
        }

        // Temporarily set positions to negative values to avoid unique constraint violations
        const tempUpdatePromises = validated.map((update, index) =>
          tx
            .update(specialists)
            .set({
              position: -(index + 1000), // Use negative values as temporary
              updatedAt: new Date(),
            })
            .where(eq(specialists.id, update.id))
        );

        await Promise.all(tempUpdatePromises);

        // Now set the actual positions
        const finalUpdatePromises = validated.map((update) =>
          tx
            .update(specialists)
            .set({
              position: update.position,
              updatedAt: new Date(),
            })
            .where(eq(specialists.id, update.id))
        );

        await Promise.all(finalUpdatePromises);

        return { updated: validated.length };
      } catch (error) {
        // Transaction will automatically rollback
        if (error instanceof Error && error.message.includes("unique_specialist_position")) {
          throw new Error("Position conflict detected. Please refresh and try again.");
        }
        throw error;
      }
    });
  }

  // Filter specialists by appointment type
  async findByAppointmentType(type: "in_person" | "telehealth" | "both") {
    // This method now needs to use EXISTS queries with appointment types
    const results = await db
      .select({
        specialist: specialists,
        user: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          jobTitle: users.jobTitle,
        },
        hasInPersonAppointments: sql<boolean>`EXISTS (
          SELECT 1 FROM ${specialistAppointmentTypes} 
          WHERE ${specialistAppointmentTypes.specialistId} = ${specialists.id}
          AND ${specialistAppointmentTypes.enabled} = true
          AND ${specialistAppointmentTypes.appointmentMode} = 'in-person'
        )`,
        hasTelehealthAppointments: sql<boolean>`EXISTS (
          SELECT 1 FROM ${specialistAppointmentTypes}
          WHERE ${specialistAppointmentTypes.specialistId} = ${specialists.id}
          AND ${specialistAppointmentTypes.enabled} = true
          AND ${specialistAppointmentTypes.appointmentMode} = 'telehealth'
        )`,
      })
      .from(specialists)
      .innerJoin(users, eq(specialists.userId, users.id))
      .where(eq(specialists.isActive, true))
      .orderBy(asc(specialists.position));

    // Filter results based on appointment type
    return results.filter(r => {
      if (type === "in_person") {
        return r.hasInPersonAppointments;
      } else if (type === "telehealth") {
        return r.hasTelehealthAppointments;
      } else {
        return r.hasInPersonAppointments && r.hasTelehealthAppointments;
      }
    }).map(r => ({
      specialist: {
        ...r.specialist,
        acceptsInPerson: r.hasInPersonAppointments,
        acceptsTelehealth: r.hasTelehealthAppointments,
      },
      user: r.user,
    }));
  }

  // Search specialists by location
  async searchByLocation(city?: string, state?: string) {
    const conditions = [eq(specialists.isActive, true)];

    if (city) {
      conditions.push(sql`lower(${specialists.location}->>'city') = lower(${city})`);
    }

    if (state) {
      conditions.push(sql`lower(${specialists.location}->>'state') = lower(${state})`);
    }

    const results = await db
      .select({
        specialist: specialists,
        user: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          jobTitle: users.jobTitle,
        },
      })
      .from(specialists)
      .innerJoin(users, eq(specialists.userId, users.id))
      .where(and(...conditions))
      .orderBy(asc(specialists.position));

    return results;
  }

  // Reorder positions after drag-and-drop
  async reorderPositions(fromPosition: number, toPosition: number, specialistId: string) {
    return await db.transaction(async (tx) => {
      // Get all specialists ordered by position
      const allSpecialists = await tx
        .select({ id: specialists.id, position: specialists.position })
        .from(specialists)
        .orderBy(asc(specialists.position));

      // Create new positions array
      const updates: Array<{ id: string; position: number }> = [];

      if (fromPosition < toPosition) {
        // Moving down
        allSpecialists.forEach((spec) => {
          if (spec.id === specialistId) {
            updates.push({ id: spec.id, position: toPosition });
          } else if (spec.position > fromPosition && spec.position <= toPosition) {
            updates.push({ id: spec.id, position: spec.position - 1 });
          }
        });
      } else {
        // Moving up
        allSpecialists.forEach((spec) => {
          if (spec.id === specialistId) {
            updates.push({ id: spec.id, position: toPosition });
          } else if (spec.position >= toPosition && spec.position < fromPosition) {
            updates.push({ id: spec.id, position: spec.position + 1 });
          }
        });
      }

      // Apply updates
      for (const update of updates) {
        await tx
          .update(specialists)
          .set({ position: update.position, updatedAt: new Date() })
          .where(eq(specialists.id, update.id));
      }

      return { updated: updates.length };
    });
  }
}

// Singleton instance
export const specialistRepository = new SpecialistRepository();
