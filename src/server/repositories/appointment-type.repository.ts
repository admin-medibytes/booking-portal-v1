import { eq, and, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { acuityAppointmentTypes as appointmentTypes, specialistAppointmentTypes } from "@/server/db/schema";

export class AppointmentTypeRepository {
  async getAll(activeOnly = true) {
    const conditions = activeOnly ? eq(appointmentTypes.active, true) : undefined;

    return await db
      .select()
      .from(appointmentTypes)
      .where(conditions)
      .orderBy(appointmentTypes.category, appointmentTypes.name);
  }

  async getById(id: string | number) {
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
    
    if (isNaN(numericId)) {
      return undefined;
    }
    
    const [result] = await db
      .select()
      .from(appointmentTypes)
      .where(eq(appointmentTypes.id, numericId))
      .limit(1);

    return result;
  }

  async getByAcuityId(acuityId: number) {
    const [result] = await db
      .select()
      .from(appointmentTypes)
      .where(eq(appointmentTypes.id, acuityId))
      .limit(1);

    return result;
  }

  async getSpecialistAppointmentTypes(specialistId: string, enabledOnly = true) {
    // This query is for the booking flow - only returns mapped and enabled types
    const baseQuery = db
      .select({
        id: appointmentTypes.id,
        acuityAppointmentTypeId: appointmentTypes.id,
        acuityName: appointmentTypes.name,
        acuityDescription: appointmentTypes.description,
        durationMinutes: appointmentTypes.duration,
        category: appointmentTypes.category,
        active: appointmentTypes.active,
        enabled: specialistAppointmentTypes.enabled,
        appointmentMode: specialistAppointmentTypes.appointmentMode,
        customDisplayName: specialistAppointmentTypes.customDisplayName,
        customDescription: specialistAppointmentTypes.customDescription,
        customPrice: specialistAppointmentTypes.customPrice,
        notes: specialistAppointmentTypes.notes,
        effectiveName: sql<string>`COALESCE(${specialistAppointmentTypes.customDisplayName}, ${appointmentTypes.name})`,
        effectiveDescription: sql<string>`COALESCE(${specialistAppointmentTypes.customDescription}, ${appointmentTypes.description})`,
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
      .orderBy(appointmentTypes.category, appointmentTypes.name);

    return await baseQuery;
  }

  async upsertSpecialistMapping(
    specialistId: string,
    appointmentTypeId: string | number,
    data: {
      enabled?: boolean;
      appointmentMode?: "in-person" | "telehealth";
      customDisplayName?: string | null;
      customDescription?: string | null;
      customPrice?: number | null;
      notes?: string | null;
    }
  ) {
    const numericId = typeof appointmentTypeId === 'string' ? parseInt(appointmentTypeId, 10) : appointmentTypeId;
    
    if (isNaN(numericId)) {
      throw new Error('Invalid appointment type ID');
    }
    
    const existing = await db
      .select()
      .from(specialistAppointmentTypes)
      .where(
        and(
          eq(specialistAppointmentTypes.specialistId, specialistId),
          eq(specialistAppointmentTypes.appointmentTypeId, numericId)
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
            eq(specialistAppointmentTypes.appointmentTypeId, numericId)
          )
        )
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(specialistAppointmentTypes)
        .values({
          specialistId,
          appointmentTypeId: numericId,
          appointmentMode: data.appointmentMode || "in-person",
          ...data,
        })
        .returning();
      return created;
    }
  }

  async validateAppointmentTypeForBooking(
    specialistId: string,
    appointmentTypeId: string | number
  ): Promise<boolean> {
    const numericId = typeof appointmentTypeId === 'string' ? parseInt(appointmentTypeId, 10) : appointmentTypeId;
    
    if (isNaN(numericId)) {
      return false;
    }

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
          eq(specialistAppointmentTypes.appointmentTypeId, numericId),
          eq(specialistAppointmentTypes.enabled, true),
          eq(appointmentTypes.active, true)
        )
      )
      .limit(1);

    return result.length > 0;
  }

  async getAppointmentTypeWithSpecialistMapping(specialistId: string, appointmentTypeId: string | number) {
    const numericId = typeof appointmentTypeId === 'string' ? parseInt(appointmentTypeId, 10) : appointmentTypeId;
    
    if (isNaN(numericId)) {
      return undefined;
    }
    
    const [result] = await db
      .select({
        id: appointmentTypes.id,
        acuityAppointmentTypeId: appointmentTypes.id,
        acuityName: appointmentTypes.name,
        acuityDescription: appointmentTypes.description,
        durationMinutes: appointmentTypes.duration,
        category: appointmentTypes.category,
        active: appointmentTypes.active,
        enabled: specialistAppointmentTypes.enabled,
        appointmentMode: specialistAppointmentTypes.appointmentMode,
        customDisplayName: specialistAppointmentTypes.customDisplayName,
        customDescription: specialistAppointmentTypes.customDescription,
        customPrice: specialistAppointmentTypes.customPrice,
        notes: specialistAppointmentTypes.notes,
        effectiveName: sql<string>`COALESCE(${specialistAppointmentTypes.customDisplayName}, ${appointmentTypes.name})`,
        effectiveDescription: sql<string>`COALESCE(${specialistAppointmentTypes.customDescription}, ${appointmentTypes.description})`,
      })
      .from(specialistAppointmentTypes)
      .innerJoin(
        appointmentTypes,
        eq(specialistAppointmentTypes.appointmentTypeId, appointmentTypes.id)
      )
      .where(
        and(
          eq(specialistAppointmentTypes.specialistId, specialistId),
          eq(specialistAppointmentTypes.appointmentTypeId, numericId),
          eq(appointmentTypes.active, true)
        )
      )
      .limit(1);

    return result;
  }
}

export const appointmentTypeRepository = new AppointmentTypeRepository();