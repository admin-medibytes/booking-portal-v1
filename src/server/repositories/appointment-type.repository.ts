import { eq, and, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { appointmentTypes, specialistAppointmentTypes } from "@/server/db/schema";

export class AppointmentTypeRepository {
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
          eq(specialistAppointmentTypes.appointmentTypeId, appointmentTypeId),
          eq(specialistAppointmentTypes.enabled, true),
          eq(appointmentTypes.active, true)
        )
      )
      .limit(1);

    return result.length > 0;
  }

  async getAppointmentTypeWithSpecialistMapping(specialistId: string, appointmentTypeId: string) {
    const [result] = await db
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
      })
      .from(specialistAppointmentTypes)
      .innerJoin(
        appointmentTypes,
        eq(specialistAppointmentTypes.appointmentTypeId, appointmentTypes.id)
      )
      .where(
        and(
          eq(specialistAppointmentTypes.specialistId, specialistId),
          eq(specialistAppointmentTypes.appointmentTypeId, appointmentTypeId),
          eq(appointmentTypes.active, true)
        )
      )
      .limit(1);

    return result;
  }
}

export const appointmentTypeRepository = new AppointmentTypeRepository();