import { bookingRepository } from "@/server/repositories/booking.repository";
import { db } from "@/server/db";
import { specialists, members, teamMembers, bookings, users, bookingProgress } from "@/server/db/schema";
import { eq, and, desc } from "drizzle-orm";
import type { User } from "@/types/user";
import type { BookingWithSpecialist, BookingFilters } from "@/types/booking";
import { acuityService } from "@/server/services/acuity.service";
import { auditService } from "@/server/services/audit.service";
import DOMPurify from "isomorphic-dompurify";

// BookingFilters is imported from types/booking.ts

export class BookingService {
  async getBookingById(bookingId: string, user: Pick<User, "id" | "role">) {
    const bookingData = await bookingRepository.findByIdWithSpecialist(bookingId);
    if (!bookingData) {
      const error = new Error("Booking not found");
      error.name = "BookingNotFoundError";
      throw error;
    }

    const hasAccess = await this.userHasAccessToBooking(user, bookingData.booking);
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

  private async getSpecialistByUserId(userId: string) {
    const result = await db
      .select()
      .from(specialists)
      .where(eq(specialists.userId, userId))
      .limit(1);

    return result[0];
  }

  private async getUserOrgMembership(userId: string) {
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

  async getUserOrganizationRole(userId: string, organizationId: string): Promise<string | undefined> {
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

  private formatBookingResponse(bookingData: {
    booking: typeof bookings.$inferSelect;
    specialist: typeof specialists.$inferSelect | null;
    specialistUser?: typeof users.$inferSelect | null;
  }): BookingWithSpecialist {
    const { booking, specialist, specialistUser } = bookingData;
    return {
      ...booking,
      specialist:
        specialist && specialistUser
          ? {
              id: specialist.id,
              name: specialistUser.name,
              specialty: specialist.specialty,
              location: null,
            }
          : null,
    };
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
        examDate,
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, bookingId))
      .returning();

    return updated;
  }

  // Sync booking with Acuity appointment
  async syncWithAcuityAppointment(bookingId: string, acuityAppointment: {
    datetime: string;
    appointmentTypeID: number;
    duration: string;
    price: string;
  }) {
    const [updated] = await db
      .update(bookings)
      .set({
        examDate: new Date(acuityAppointment.datetime),
        updatedAt: new Date(),
        metadata: {
          ...(await this.getBookingMetadata(bookingId)),
          lastAcuitySync: new Date().toISOString(),
          acuityData: {
            appointmentTypeId: acuityAppointment.appointmentTypeID,
            duration: acuityAppointment.duration,
            price: acuityAppointment.price,
          },
        },
      })
      .where(eq(bookings.id, bookingId))
      .returning();

    return updated;
  }

  // Helper to get existing metadata
  private async getBookingMetadata(bookingId: string): Promise<Record<string, unknown>> {
    const [booking] = await db
      .select({ metadata: bookings.metadata })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);

    return (booking?.metadata as Record<string, unknown>) || {};
  }

  // Create a new booking
  async createBooking(data: {
    specialistId: string;
    appointmentDateTime: Date;
    examineeName: string;
    examineePhone: string;
    examineeEmail?: string | null;
    appointmentType: "in_person" | "telehealth";
    notes?: string | null;
    referrerId: string;
  }) {
    // Sanitize all string inputs
    const sanitizedData = {
      ...data,
      examineeName: DOMPurify.sanitize(data.examineeName),
      examineePhone: DOMPurify.sanitize(data.examineePhone),
      examineeEmail: data.examineeEmail ? DOMPurify.sanitize(data.examineeEmail) : null,
      notes: data.notes ? DOMPurify.sanitize(data.notes) : null,
    };

    // Validate specialist exists
    const [specialist] = await db
      .select()
      .from(specialists)
      .where(and(
        eq(specialists.id, sanitizedData.specialistId),
        eq(specialists.isActive, true)
      ))
      .limit(1);

    if (!specialist) {
      throw new Error("Specialist not found or inactive");
    }

    // Begin transaction
    const booking = await db.transaction(async (tx) => {
      // Re-check availability with database lock
      const isAvailable = await this.checkTimeSlotAvailability(
        sanitizedData.specialistId,
        sanitizedData.appointmentDateTime,
        tx
      );

      if (!isAvailable) {
        throw new Error("Time slot not available");
      }

      // Get user's organization ID through members table
      const [member] = await tx
        .select()
        .from(members)
        .where(eq(members.userId, sanitizedData.referrerId))
        .limit(1);
      
      if (!member?.organizationId) {
        throw new Error("User organization not found");
      }

      // Create booking in database
      const [newBooking] = await tx
        .insert(bookings)
        .values({
          organizationId: member.organizationId,
          specialistId: sanitizedData.specialistId,
          referrerId: sanitizedData.referrerId,
          examDate: sanitizedData.appointmentDateTime,
          patientFirstName: sanitizedData.examineeName.split(" ")[0] || "",
          patientLastName: sanitizedData.examineeName.split(" ").slice(1).join(" ") || "",
          patientDateOfBirth: new Date("1970-01-01"), // Placeholder - should be collected in form
          patientPhone: sanitizedData.examineePhone,
          patientEmail: sanitizedData.examineeEmail,
          examinationType: "Independent Medical Examination",
          examLocation: sanitizedData.appointmentType,
          status: "active",
          metadata: {
            notes: sanitizedData.notes,
            createdVia: "portal",
            appointmentType: sanitizedData.appointmentType,
          },
        })
        .returning();

      // Create Acuity appointment
      try {
        const acuityAppointment = await acuityService.createAppointment({
          datetime: sanitizedData.appointmentDateTime.toISOString(),
          appointmentTypeID: 1, // TODO: Get from specialist configuration
          calendarID: parseInt(specialist.acuityCalendarId, 10),
          firstName: sanitizedData.examineeName.split(" ")[0] || "",
          lastName: sanitizedData.examineeName.split(" ").slice(1).join(" ") || "",
          phone: sanitizedData.examineePhone,
          email: sanitizedData.examineeEmail || "",
          notes: sanitizedData.notes || "",
        });

        // Update booking with Acuity ID
        const [updatedBooking] = await tx
          .update(bookings)
          .set({
            acuityAppointmentId: acuityAppointment.id,
            updatedAt: new Date(),
          })
          .where(eq(bookings.id, newBooking.id))
          .returning();

        return updatedBooking;
      } catch (error) {
        console.error("Failed to create Acuity appointment:", error);
        throw new Error("Failed to sync with scheduling system");
      }
    });

    return booking;
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
      .where(and(
        eq(bookings.specialistId, specialistId),
        eq(bookings.examDate, dateTime),
        eq(bookings.status, "active")
      ))
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
        reason: bookingProgress.reason,
        metadata: bookingProgress.metadata,
        createdAt: bookingProgress.createdAt,
        changedBy: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(bookingProgress)
      .leftJoin(users, eq(bookingProgress.changedBy, users.id))
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
      bookingData.booking
    );
    if (!hasAccess) {
      const error = new Error("Access denied");
      error.name = "AccessDeniedError";
      throw error;
    }

    // Additional check for specialists - can only update their own bookings
    if (context.organizationRole === "specialist") {
      const specialistData = await this.getSpecialistByUserId(context.userId);
      if (!specialistData || specialistData.id !== bookingData.booking.specialistId) {
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
      const error = new Error(
        `Invalid transition from ${currentProgress} to ${newProgress}`
      );
      error.name = "InvalidTransitionError";
      throw error;
    }

    // Update in transaction
    await db.transaction(async (tx) => {
      // Create progress entry
      await tx.insert(bookingProgress).values({
        bookingId,
        fromStatus: currentProgress as "scheduled" | "rescheduled" | "cancelled" | "no-show" | "generating-report" | "report-generated" | "payment-received" | null,
        toStatus: newProgress as "scheduled" | "rescheduled" | "cancelled" | "no-show" | "generating-report" | "report-generated" | "payment-received",
        changedBy: context.userId,
        reason: context.notes,
        metadata: context.impersonatedUserId
          ? { impersonatedUserId: context.impersonatedUserId }
          : {},
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

      await tx
        .update(bookings)
        .set(updateData)
        .where(eq(bookings.id, bookingId));
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
