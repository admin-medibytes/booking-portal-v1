import { bookingRepository } from "@/server/repositories/booking.repository";
import { appointmentTypeRepository } from "@/server/repositories/appointment-type.repository";
import { db } from "@/server/db";
import {
  specialists,
  members,
  teamMembers,
  bookings,
  users,
  bookingProgress,
  referrers,
  examinees,
  specialistAppointmentTypes,
  appForms,
  appFormFields,
  acuityAppointmentTypeForms,
  organizations,
} from "@/server/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import type { User } from "@/types/user";
import type { BookingWithSpecialist, BookingFilters } from "@/types/booking";
import type { ExamineeFieldType } from "@/server/db/schema/appForms";
import { acuityService } from "@/server/services/acuity.service";
import { auditService } from "@/server/services/audit.service";
import DOMPurify from "isomorphic-dompurify";
import { formatLocationFull } from "@/lib/utils/location";

// BookingFilters is imported from types/booking.ts

export class BookingService {
  async getBookingById(bookingId: string, user: Pick<User, "id" | "role">) {
    const bookingData = await bookingRepository.findByIdWithSpecialist(bookingId);
    if (!bookingData) {
      const error = new Error("Booking not found");
      error.name = "BookingNotFoundError";
      throw error;
    }

    // Handle both old and new format
    const hasAccess = await this.userHasAccessToBooking(user, bookingData);
    if (!hasAccess) {
      const error = new Error("Access denied");
      error.name = "AccessDeniedError";
      throw error;
    }

    // Get progress history
    const progressHistory = await this.getBookingProgressHistory(bookingId);

    // Get current progress from latest entry or default
    const currentProgress = progressHistory[0]?.toStatus || "scheduled";

    return {
      ...this.formatBookingResponse(bookingData),
      progress: progressHistory,
      currentProgress,
      documents: [], // Placeholder for future document implementation
    };
  }

  async getBookingsForUser(user: Pick<User, "id" | "role">, filters?: BookingFilters) {
    if (user.role === "admin") {
      return this.getBookingsForAdmin(filters);
    }

    const orgMembership = await this.getUserOrgMembership(user.id);

    if (orgMembership?.role === "owner") {
      return this.getBookingsForOrganizationOwner(orgMembership.organizationId, filters);
    }

    // Team management will be added when teamId is added to bookings table
    if (orgMembership?.role === "manager") {
      // For now, managers see organization bookings
      return this.getBookingsForOrganizationOwner(orgMembership.organizationId, filters);
    }

    const specialistData = await this.getSpecialistByUserId(user.id);
    if (specialistData) {
      return this.getBookingsForSpecialist(specialistData.id, filters);
    }

    return this.getBookingsForReferrer(user.id, filters);
  }

  private async getBookingsForAdmin(filters?: BookingFilters) {
    const result = await bookingRepository.findAllForAdmin(filters);
    return {
      bookings: result.data.map((item) => this.formatBookingResponse(item)),
      pagination: result.pagination,
    };
  }

  private async getBookingsForReferrer(userId: string, filters?: BookingFilters) {
    const result = await bookingRepository.findForReferrer(userId, filters);
    return {
      bookings: result.data.map((item) => this.formatBookingResponse(item)),
      pagination: result.pagination,
    };
  }

  private async getBookingsForSpecialist(specialistId: string, filters?: BookingFilters) {
    const result = await bookingRepository.findForSpecialist(specialistId, filters);
    return {
      bookings: result.data.map((item) => this.formatBookingResponse(item)),
      pagination: result.pagination,
    };
  }

  private async getBookingsForOrganizationOwner(organizationId: string, filters?: BookingFilters) {
    const result = await bookingRepository.findForOrganization(organizationId, filters);
    return {
      bookings: result.data.map((item) => this.formatBookingResponse(item)),
      pagination: result.pagination,
    };
  }

  // Team filtering will be implemented when teamId is added to bookings table

  private async userHasAccessToBooking(
    user: Pick<User, "id" | "role">,
    booking: typeof bookings.$inferSelect
  ): Promise<boolean> {
    if (user.role === "admin") {
      return true;
    }

    if (booking.referrerId === user.id) {
      return true;
    }

    const specialistData = await this.getSpecialistByUserId(user.id);
    if (specialistData && booking.specialistId === specialistData.id) {
      return true;
    }

    const orgMembership = await this.getUserOrgMembership(user.id);
    if (orgMembership) {
      if (
        orgMembership.role === "owner" &&
        booking.organizationId === orgMembership.organizationId
      ) {
        return true;
      }

      // Team-based access will be added when teamId is available
    }

    return false;
  }

  async getSpecialistByUserId(userId: string) {
    const result = await db
      .select()
      .from(specialists)
      .where(eq(specialists.userId, userId))
      .limit(1);

    return result[0];
  }

  async getUserOrgMembership(userId: string) {
    const result = await db.select().from(members).where(eq(members.userId, userId)).limit(1);

    if (!result[0]) return null;

    // Get user's teams
    const userTeams = await db.select().from(teamMembers).where(eq(teamMembers.userId, userId));

    return {
      organizationId: result[0].organizationId,
      role: result[0].role,
      teamIds: userTeams.map((tm) => tm.teamId),
    };
  }

  async getBookingForAccess(bookingId: string) {
    // Get booking without access checks for internal use
    const result = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);

    return result[0];
  }

  async isUserInTeams(userId: string, teamIds: string[]): Promise<boolean> {
    if (teamIds.length === 0) return false;

    const result = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.userId, userId), inArray(teamMembers.teamId, teamIds)))
      .limit(1);

    return result.length > 0;
  }

  async getUserOrganizationRole(
    userId: string,
    organizationId: string
  ): Promise<string | undefined> {
    const result = await db
      .select()
      .from(members)
      .where(and(eq(members.userId, userId), eq(members.organizationId, organizationId)))
      .limit(1);

    return result[0]?.role;
  }

  async isUserSpecialist(userId: string, specialistId: string): Promise<boolean> {
    const specialist = await db
      .select()
      .from(specialists)
      .where(and(eq(specialists.id, specialistId), eq(specialists.userId, userId)))
      .limit(1);

    return specialist.length > 0;
  }

  private formatBookingResponse(bookingData: any) {
    // Handle both the old select format and the new query format
    if (bookingData.booking) {
      // Old format from select joins
      const { booking, specialist, specialistUser, referrer, examinee, referrerOrganization } =
        bookingData;
      return {
        ...booking,
        specialist:
          specialist && specialistUser
            ? {
                id: specialist.id,
                name: specialistUser.name,
                jobTitle: specialistUser.jobTitle,
                location: specialist.location,
              }
            : { id: "", name: "", jobTitle: "", location: null },
        referrer: referrer || null,
        examinee: examinee || null,
        referrerOrganization: referrerOrganization || null,
      };
    } else {
      // New format from query builder
      return {
        ...bookingData,
        specialist: bookingData.specialist
          ? {
              id: bookingData.specialist.id,
              name: bookingData.specialist.user?.name || "",
              jobTitle: bookingData.specialist.user?.jobTitle || "",
              location: bookingData.specialist.location,
            }
          : { id: "", name: "", jobTitle: "", location: null },
        referrerOrganization: bookingData.referrer?.organization || null,
      };
    }
  }

  // Find booking by Acuity appointment ID
  async findByAcuityAppointmentId(acuityAppointmentId: string) {
    const result = await db
      .select()
      .from(bookings)
      .where(eq(bookings.acuityAppointmentId, parseInt(acuityAppointmentId, 10)))
      .limit(1);

    return result[0] || null;
  }

  // Update booking status
  async updateBookingStatus(bookingId: string, status: "active" | "closed" | "archived") {
    const [updated] = await db
      .update(bookings)
      .set({
        status,
        updatedAt: new Date(),
        ...(status === "closed" ? { completedAt: new Date() } : {}),
        ...(status === "archived" ? { cancelledAt: new Date() } : {}),
      })
      .where(eq(bookings.id, bookingId))
      .returning();

    return updated;
  }

  // Update booking exam date
  async updateBookingExamDate(bookingId: string, examDate: Date) {
    const [updated] = await db
      .update(bookings)
      .set({
        dateTime: examDate,
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, bookingId))
      .returning();

    return updated;
  }

  // Sync booking with Acuity appointment
  async syncWithAcuityAppointment(
    bookingId: string,
    acuityAppointment: {
      datetime: string;
      appointmentTypeID: number;
      duration: string;
      price: string;
    }
  ) {
    throw new Error("booking.service.syncWithAcuityAppointment: Not implemented");
    // const [updated] = await db
    //   .update(bookings)
    //   .set({
    //     dateTime: new Date(acuityAppointment.datetime),
    //     updatedAt: new Date(),
    //   })
    //   .where(eq(bookings.id, bookingId))
    //   .returning();

    // return updated;
  }

  // Extract examinee data from form fields based on field mappings
  private async extractExamineeDataFromFields(
    appointmentTypeId: number,
    fields: { id: number; value: string }[]
  ): Promise<
    Partial<{
      firstName: string;
      lastName: string;
      dateOfBirth: string;
      email: string;
      phoneNumber: string;
      address: string;
      authorizedContact: string;
      condition: string;
      caseType: string;
      [key: string]: string;
    }>
  > {
    // Get the form configuration with field mappings
    const formMappings = await db
      .select({
        acuityFieldId: appFormFields.acuityFieldId,
        examineeFieldMapping: appFormFields.examineeFieldMapping,
      })
      .from(appFormFields)
      .innerJoin(appForms, eq(appFormFields.appFormId, appForms.id))
      .innerJoin(
        acuityAppointmentTypeForms,
        eq(appForms.acuityFormId, acuityAppointmentTypeForms.formId)
      )
      .where(
        and(
          eq(acuityAppointmentTypeForms.appointmentTypeId, appointmentTypeId),
          eq(appForms.isActive, true)
        )
      );

    // Create a map of field ID to examinee field mapping
    const fieldMappingMap = new Map<number, ExamineeFieldType>();
    formMappings.forEach((mapping) => {
      if (mapping.examineeFieldMapping) {
        fieldMappingMap.set(mapping.acuityFieldId, mapping.examineeFieldMapping);
      }
    });

    // Extract examinee data from submitted fields
    const examineeData: Record<string, string> = {};
    for (const field of fields) {
      const mapping = fieldMappingMap.get(field.id);
      if (mapping && field.value) {
        examineeData[mapping] = field.value;
      }
    }

    return examineeData;
  }

  // Create a new booking
  async createBooking(data: {
    appointmentTypeId: number;
    datetime: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    timezone: string;
    organizationId: string;
    teamId: string;
    createdById: string;
    specialistId: string;
    fields: {
      id: number;
      value: string;
    }[];
  }) {
    // Validate specialist exists
    const specialist = await db.query.specialists.findFirst({
      where: and(eq(specialists.id, data.specialistId), eq(specialists.isActive, true)),
    });

    if (!specialist) {
      throw new Error("Specialist not found or inactive");
    }

    const specialistAppointmentType = await db.query.specialistAppointmentTypes.findFirst({
      where: and(
        eq(specialistAppointmentTypes.specialistId, specialist.id),
        eq(specialistAppointmentTypes.appointmentTypeId, data.appointmentTypeId)
      ),
      with: { appointmentType: true },
    });

    if (!specialistAppointmentType) {
      throw new Error("Appointment type not found");
    }

    // Extract examinee data from form fields
    const extractedExamineeData1 = await this.extractExamineeDataFromFields(
      data.appointmentTypeId,
      data.fields
    );

    // Create acuity appointment
    let acuityAppointment;
    try {
      acuityAppointment = await acuityService.createAppointment({
        datetime: data.datetime,
        appointmentTypeID: specialistAppointmentType.appointmentTypeId,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        timezone: data.timezone,
        fields: data.fields,
      });
    } catch (error) {
      console.error("Failed to create Acuity appointment:", error);
      throw new Error("Failed to sync with scheduling system");
    }

    // Extract examinee data from form fields
    const extractedExamineeData = await this.extractExamineeDataFromFields(
      data.appointmentTypeId,
      data.fields
    );

    try {
      const booking = await db.transaction(async (tx) => {
        const referrerUser = await tx.query.users.findFirst({
          where: eq(users.email, data.email),
          columns: { id: true, jobTitle: true },
        });

        // Create referrer record
        const [referrerRecord] = await tx
          .insert(referrers)
          .values({
            organizationId: data.organizationId,
            userId: referrerUser?.id,
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            phone: data.phone,
            jobTitle: referrerUser?.jobTitle,
          })
          .returning();

        // Create examinee record with extracted data from form fields
        const [examineeRecord] = await tx
          .insert(examinees)
          .values({
            referrerId: referrerRecord.id,
            firstName: extractedExamineeData.firstName || "",
            lastName: extractedExamineeData.lastName || "",
            dateOfBirth: extractedExamineeData.dateOfBirth || "",
            address: extractedExamineeData.address || "",
            email: extractedExamineeData.email || "",
            phoneNumber: extractedExamineeData.phoneNumber || "",
            authorizedContact:
              extractedExamineeData.authorizedContact === "true" ||
              extractedExamineeData.authorizedContact === "yes" ||
              extractedExamineeData.authorizedContact === "1" ||
              false, // Default to true if not specified
            condition: extractedExamineeData.condition || "",
            caseType: extractedExamineeData.caseType || "",
          })
          .returning();

        // Create booking in database with Acuity ID
        const [newBooking] = await tx
          .insert(bookings)
          .values({
            organizationId: data.organizationId,
            teamId: data.teamId,
            createdById: data.createdById,
            referrerId: referrerRecord.id,
            specialistId: specialist.id,
            examineeId: examineeRecord.id,
            status: "active",
            type: specialistAppointmentType.appointmentMode,
            duration: specialistAppointmentType.appointmentType.duration,
            location:
              specialistAppointmentType.appointmentMode === "telehealth"
                ? "Generating link"
                : specialist.location === null
                  ? "[Admin to advise]"
                  : (formatLocationFull(specialist.location) ?? "[Admin to advise]"),
            dateTime: new Date(data.datetime),
            acuityAppointmentId: acuityAppointment.id, // Use the Acuity ID directly
            acuityAppointmentTypeId: specialistAppointmentType.appointmentTypeId,
            acuityCalendarId: specialist.acuityCalendarId,
            scheduledAt: new Date(),
          })
          .returning();

        return newBooking;
      });

      return booking;
    } catch (error) {
      // Database transaction failed, need to cancel the Acuity appointment
      console.error(
        "Failed to create database records, Acuity appointment id is:",
        acuityAppointment.id
      );
      throw error; // Re-throw the original database error
    }
  }

  // Check if a time slot is available
  private async checkTimeSlotAvailability(
    specialistId: string,
    dateTime: Date,
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0]
  ): Promise<boolean> {
    // Check for existing bookings at the same time
    const existingBookings = await tx
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.specialistId, specialistId),
          eq(bookings.dateTime, dateTime),
          eq(bookings.status, "active")
        )
      )
      .limit(1);

    return existingBookings.length === 0;
  }

  // Get booking progress history
  private async getBookingProgressHistory(bookingId: string) {
    const progressEntries = await db
      .select({
        id: bookingProgress.id,
        bookingId: bookingProgress.bookingId,
        fromStatus: bookingProgress.fromStatus,
        toStatus: bookingProgress.toStatus,
        createdAt: bookingProgress.createdAt,
        changedBy: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(bookingProgress)
      .leftJoin(users, eq(bookingProgress.changedById, users.id))
      .where(eq(bookingProgress.bookingId, bookingId))
      .orderBy(desc(bookingProgress.createdAt));

    return progressEntries;
  }

  // Update booking progress with validation and audit logging
  async updateBookingProgress(
    bookingId: string,
    newProgress: string,
    context: {
      userId: string;
      userRole: "user" | "admin" | null;
      organizationRole?: string;
      notes?: string | null;
      impersonatedUserId?: string;
    }
  ) {
    // Validate state transitions
    const validTransitions: Record<string, string[]> = {
      scheduled: ["rescheduled", "cancelled", "no-show", "generating-report"],
      rescheduled: ["cancelled", "no-show", "generating-report"],
      cancelled: [],
      "no-show": [],
      "generating-report": ["report-generated"],
      "report-generated": ["payment-received"],
      "payment-received": [],
    };

    // Get current booking
    const bookingData = await bookingRepository.findByIdWithSpecialist(bookingId);
    if (!bookingData) {
      const error = new Error("Booking not found");
      error.name = "BookingNotFoundError";
      throw error;
    }

    // Check access
    const hasAccess = await this.userHasAccessToBooking(
      { id: context.userId, role: context.userRole },
      bookingData
    );
    if (!hasAccess) {
      const error = new Error("Access denied");
      error.name = "AccessDeniedError";
      throw error;
    }

    // Additional check for specialists - can only update their own bookings
    if (context.organizationRole === "specialist") {
      const specialistData = await this.getSpecialistByUserId(context.userId);
      if (!specialistData || specialistData.id !== bookingData.specialistId) {
        const error = new Error("Specialists can only update their own bookings");
        error.name = "AccessDeniedError";
        throw error;
      }
    }

    // Get current progress
    const progressHistory = await this.getBookingProgressHistory(bookingId);
    const currentProgress = progressHistory[0]?.toStatus || "scheduled";

    // Validate transition
    const allowedTransitions = validTransitions[currentProgress] || [];
    if (!allowedTransitions.includes(newProgress)) {
      const error = new Error(`Invalid transition from ${currentProgress} to ${newProgress}`);
      error.name = "InvalidTransitionError";
      throw error;
    }

    // Update in transaction
    await db.transaction(async (tx) => {
      // Create progress entry
      await tx.insert(bookingProgress).values({
        bookingId,
        fromStatus: currentProgress as
          | "scheduled"
          | "rescheduled"
          | "cancelled"
          | "no-show"
          | "generating-report"
          | "report-generated"
          | "payment-received"
          | null,
        toStatus: newProgress as
          | "scheduled"
          | "rescheduled"
          | "cancelled"
          | "no-show"
          | "generating-report"
          | "report-generated"
          | "payment-received",
        changedById: context.userId,
      });

      // Update booking timestamps based on progress
      const updateData: Partial<typeof bookings.$inferInsert> = {
        updatedAt: new Date(),
      };

      if (newProgress === "cancelled") {
        updateData.cancelledAt = new Date();
        updateData.status = "closed";
      } else if (newProgress === "payment-received") {
        updateData.completedAt = new Date();
        updateData.status = "closed";
      }

      await tx.update(bookings).set(updateData).where(eq(bookings.id, bookingId));
    });

    // Create audit log
    await auditService.log({
      userId: context.userId,
      impersonatedUserId: context.impersonatedUserId,
      action: "booking.progress.updated",
      resourceType: "booking",
      resourceId: bookingId,
      metadata: {
        previousProgress: currentProgress,
        newProgress,
        notes: context.notes,
      },
    });

    // Return updated booking with details
    return this.getBookingById(bookingId, { id: context.userId, role: context.userRole });
  }
}

export const bookingService = new BookingService();
