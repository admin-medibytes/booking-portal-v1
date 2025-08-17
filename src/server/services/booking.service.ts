import { bookingRepository } from "@/server/repositories/booking.repository";
import { db } from "@/server/db";
import { specialists, members, teamMembers, bookings, users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import type { User } from "@/types/user";
import type { BookingWithSpecialist, BookingFilters } from "@/types/booking";

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
}

export const bookingService = new BookingService();
