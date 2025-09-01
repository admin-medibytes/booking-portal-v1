import { eq, and, sql, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { appointmentTypes, specialistAppointmentTypes } from "@/server/db/schema";
import type { AcuityAppointmentTypeType } from "@/types/acuity";

export class AppointmentTypeRepository {
  async upsertFromAcuity(acuityTypes: AcuityAppointmentTypeType[]) {
    const results = await db.transaction(async (tx) => {
      const upserted = [];

      for (const acuityType of acuityTypes) {
        const existing = await tx
          .select()
          .from(appointmentTypes)
          .where(eq(appointmentTypes.acuityAppointmentTypeId, acuityType.id))
          .limit(1);

        if (existing.length > 0) {
          const [updated] = await tx
            .update(appointmentTypes)
            .set({
              acuityName: acuityType.name,
              acuityDescription: acuityType.description || null,
              durationMinutes: acuityType.duration,
              category: acuityType.category || null,
              active: true, // Acuity types are always active when synced
              lastSyncedAt: new Date(),
              raw: acuityType as any,
              updatedAt: new Date(),
            })
            .where(eq(appointmentTypes.id, existing[0].id))
            .returning();
          upserted.push(updated);
        } else {
          const [created] = await tx
            .insert(appointmentTypes)
            .values({
              acuityAppointmentTypeId: acuityType.id,
              acuityName: acuityType.name,
              acuityDescription: acuityType.description || null,
              durationMinutes: acuityType.duration,
              category: acuityType.category || null,
              active: true, // Acuity types are always active when synced
              lastSyncedAt: new Date(),
              raw: acuityType as any,
            })
            .returning();
          upserted.push(created);
        }
      }

      return upserted;
    });

    return results;
  }

  async getAll(activeOnly = true) {
    const conditions = activeOnly ? eq(appointmentTypes.active, true) : undefined;

    return await db
      .select()
      .from(appointmentTypes)
      .where(conditions)
      .orderBy(appointmentTypes.category, appointmentTypes.acuityName);
  }

  async getById(id: string) {
    const [result] = await db
      .select()
      .from(appointmentTypes)
      .where(eq(appointmentTypes.id, id))
      .limit(1);

    return result;
  }

  async getByAcuityId(acuityId: number) {
    const [result] = await db
      .select()
      .from(appointmentTypes)
      .where(eq(appointmentTypes.acuityAppointmentTypeId, acuityId))
      .limit(1);

    return result;
  }

  async getSpecialistAppointmentTypes(specialistId: string, enabledOnly = true) {
    // This query is for the booking flow - only returns mapped and enabled types
    const baseQuery = db
      .select({
        id: appointmentTypes.id,
        acuityAppointmentTypeId: appointmentTypes.acuityAppointmentTypeId,
        acuityName: appointmentTypes.acuityName,
        acuityDescription: appointmentTypes.acuityDescription,
        durationMinutes: appointmentTypes.durationMinutes,
        category: appointmentTypes.category,
        active: appointmentTypes.active,
        enabled: specialistAppointmentTypes.enabled,
        appointmentMode: specialistAppointmentTypes.appointmentMode,
        customDisplayName: specialistAppointmentTypes.customDisplayName,
        customDescription: specialistAppointmentTypes.customDescription,
        customPrice: specialistAppointmentTypes.customPrice,
        notes: specialistAppointmentTypes.notes,
        effectiveName: sql<string>`COALESCE(${specialistAppointmentTypes.customDisplayName}, ${appointmentTypes.acuityName})`,
        effectiveDescription: sql<string>`COALESCE(${specialistAppointmentTypes.customDescription}, ${appointmentTypes.acuityDescription})`,
        sourceName: sql<string>`CASE WHEN ${specialistAppointmentTypes.customDisplayName} IS NULL THEN 'acuity' ELSE 'override' END`,
        sourceDescription: sql<string>`CASE WHEN ${specialistAppointmentTypes.customDescription} IS NULL THEN 'acuity' ELSE 'override' END`,
      })
      .from(specialistAppointmentTypes)
      .innerJoin(
        appointmentTypes,
        eq(specialistAppointmentTypes.appointmentTypeId, appointmentTypes.id)
      )
      .where(
        and(
          eq(specialistAppointmentTypes.specialistId, specialistId),
          eq(appointmentTypes.active, true),
          enabledOnly ? eq(specialistAppointmentTypes.enabled, true) : undefined
        )
      )
      .orderBy(appointmentTypes.category, appointmentTypes.acuityName);

    return await baseQuery;
  }

  async getAllAppointmentTypesForSpecialist(specialistId: string) {
    // This query is for admin management - returns ALL appointment types with optional mappings
    const baseQuery = db
      .select({
        id: appointmentTypes.id,
        acuityAppointmentTypeId: appointmentTypes.acuityAppointmentTypeId,
        acuityName: appointmentTypes.acuityName,
        acuityDescription: appointmentTypes.acuityDescription,
        durationMinutes: appointmentTypes.durationMinutes,
        category: appointmentTypes.category,
        active: appointmentTypes.active,
        enabled: sql<boolean>`COALESCE(${specialistAppointmentTypes.enabled}, false)`.as("enabled"),
        appointmentMode: specialistAppointmentTypes.appointmentMode,
        customDisplayName: specialistAppointmentTypes.customDisplayName,
        customDescription: specialistAppointmentTypes.customDescription,
        customPrice: specialistAppointmentTypes.customPrice,
        notes: specialistAppointmentTypes.notes,
        effectiveName:
          sql<string>`COALESCE(${specialistAppointmentTypes.customDisplayName}, ${appointmentTypes.acuityName})`.as(
            "effectiveName"
          ),
        effectiveDescription: sql<
          string | null
        >`COALESCE(${specialistAppointmentTypes.customDescription}, ${appointmentTypes.acuityDescription})`.as(
          "effectiveDescription"
        ),
        sourceName:
          sql<string>`CASE WHEN ${specialistAppointmentTypes.customDisplayName} IS NULL THEN 'acuity' ELSE 'override' END`.as(
            "sourceName"
          ),
        sourceDescription:
          sql<string>`CASE WHEN ${specialistAppointmentTypes.customDescription} IS NULL THEN 'acuity' ELSE 'override' END`.as(
            "sourceDescription"
          ),
      })
      .from(appointmentTypes)
      .leftJoin(
        specialistAppointmentTypes,
        and(
          eq(specialistAppointmentTypes.appointmentTypeId, appointmentTypes.id),
          eq(specialistAppointmentTypes.specialistId, specialistId)
        )
      )
      .where(eq(appointmentTypes.active, true))
      .orderBy(appointmentTypes.category, appointmentTypes.acuityName);

    return await baseQuery;
  }

  async upsertSpecialistMapping(
    specialistId: string,
    appointmentTypeId: string,
    data: {
      enabled?: boolean;
      appointmentMode?: "in-person" | "telehealth";
      customDisplayName?: string | null;
      customDescription?: string | null;
      customPrice?: number | null;
      notes?: string | null;
    }
  ) {
    const existing = await db
      .select()
      .from(specialistAppointmentTypes)
      .where(
        and(
          eq(specialistAppointmentTypes.specialistId, specialistId),
          eq(specialistAppointmentTypes.appointmentTypeId, appointmentTypeId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(specialistAppointmentTypes)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(specialistAppointmentTypes.specialistId, specialistId),
            eq(specialistAppointmentTypes.appointmentTypeId, appointmentTypeId)
          )
        )
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(specialistAppointmentTypes)
        .values({
          specialistId,
          appointmentTypeId,
          appointmentMode: data.appointmentMode || "in-person",
          ...data,
        })
        .returning();
      return created;
    }
  }

  async bulkUpdateSpecialistMappings(
    specialistId: string,
    updates: Array<{
      appointmentTypeId: string;
      enabled?: boolean;
      appointmentMode: "in-person" | "telehealth";
      customDisplayName?: string | null;
      customDescription?: string | null;
      customPrice?: number | null;
      notes?: string | null;
    }>
  ) {
    return await db.transaction(async (tx) => {
      const results = [];

      for (const update of updates) {
        const { appointmentTypeId, ...data } = update;

        const existing = await tx
          .select()
          .from(specialistAppointmentTypes)
          .where(
            and(
              eq(specialistAppointmentTypes.specialistId, specialistId),
              eq(specialistAppointmentTypes.appointmentTypeId, appointmentTypeId)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          const [updated] = await tx
            .update(specialistAppointmentTypes)
            .set({
              ...data,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(specialistAppointmentTypes.specialistId, specialistId),
                eq(specialistAppointmentTypes.appointmentTypeId, appointmentTypeId)
              )
            )
            .returning();
          results.push(updated);
        } else {
          const [created] = await tx
            .insert(specialistAppointmentTypes)
            .values({
              specialistId,
              appointmentTypeId,
              enabled: data.enabled ?? true,
              appointmentMode: data.appointmentMode || "in-person",
              customDisplayName: data.customDisplayName,
              customDescription: data.customDescription,
              customPrice: data.customPrice,
              notes: data.notes,
            })
            .returning();
          results.push(created);
        }
      }

      return results;
    });
  }

  async autoEnableByCategory(specialistId: string, categories: string[]) {
    const typesInCategories = await db
      .select({ id: appointmentTypes.id })
      .from(appointmentTypes)
      .where(
        and(
          eq(appointmentTypes.active, true),
          categories.length > 0 ? inArray(appointmentTypes.category, categories) : undefined
        )
      );

    const enabledCount = await this.bulkUpdateSpecialistMappings(
      specialistId,
      typesInCategories.map((t) => ({
        appointmentTypeId: t.id,
        enabled: true,
        appointmentMode: "in-person" as const,
      }))
    );

    return enabledCount.length;
  }

  async validateAppointmentTypeForBooking(
    specialistId: string,
    appointmentTypeId: string
  ): Promise<boolean> {
    const result = await db
      .select({
        valid: sql<number>`1`,
      })
      .from(specialistAppointmentTypes)
      .innerJoin(
        appointmentTypes,
        eq(specialistAppointmentTypes.appointmentTypeId, appointmentTypes.id)
      )
      .where(
        and(
          eq(specialistAppointmentTypes.specialistId, specialistId),
          eq(appointmentTypes.id, appointmentTypeId),
          eq(specialistAppointmentTypes.enabled, true),
          eq(appointmentTypes.active, true)
        )
      )
      .limit(1);

    return result.length > 0;
  }
}

export const appointmentTypeRepository = new AppointmentTypeRepository();
