import { bookingRepository } from "@/server/repositories/booking.repository";
import { db } from "@/server/db";
import { specialists, members, teamMembers, bookings, users } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import type { User } from "@/types/user";
import type { BookingWithSpecialist, BookingFilters } from "@/types/booking";
import { acuityService } from "@/server/services/acuity.service";
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

    return this.formatBookingResponse(bookingData);
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
}

export const bookingService = new BookingService();
