import { db } from "@/server/db";
import { bookings, examinees, specialists, referrers } from "@/server/db/schema";
import { users } from "@/server/db/schema/auth";
import { eq, and, gte, lte, desc, sql, SQL, inArray, or, ilike } from "drizzle-orm";
import type { BookingFilters } from "@/types/booking";

export class BookingRepository {
  // Optimized calendar query using raw SQL joins for maximum performance
  async findForCalendar(conditions: SQL[], filters?: BookingFilters) {
    const limit = filters?.limit || 1000;

    // Use raw SQL joins and flatten the selection, then reshape
    const rows = await db
      .select({
        // Booking fields
        id: bookings.id,
        organizationId: bookings.organizationId,
        teamId: bookings.teamId,
        createdById: bookings.createdById,
        referrerId: bookings.referrerId,
        specialistId: bookings.specialistId,
        examineeId: bookings.examineeId,
        status: bookings.status,
        type: bookings.type,
        duration: bookings.duration,
        location: bookings.location,
        dateTime: bookings.dateTime,
        acuityAppointmentId: bookings.acuityAppointmentId,
        acuityAppointmentTypeId: bookings.acuityAppointmentTypeId,
        acuityCalendarId: bookings.acuityCalendarId,
        scheduledAt: bookings.scheduledAt,
        completedAt: bookings.completedAt,
        cancelledAt: bookings.cancelledAt,
        createdAt: bookings.createdAt,
        updatedAt: bookings.updatedAt,

        // Specialist fields (flattened)
        specialistId_: specialists.id,
        specialistName: specialists.name,

        // User fields (flattened)
        userId: users.id,
        userJobTitle: users.jobTitle,

        // Referrer fields (flattened)
        referrerId_: referrers.id,
        referrerFirstName: referrers.firstName,
        referrerLastName: referrers.lastName,

        // Examinee fields (flattened)
        examineeId_: examinees.id,
        examineeFirstName: examinees.firstName,
        examineeLastName: examinees.lastName,
        examineeEmail: examinees.email,
      })
      .from(bookings)
      .leftJoin(specialists, eq(bookings.specialistId, specialists.id))
      .leftJoin(users, eq(specialists.userId, users.id))
      .leftJoin(referrers, eq(bookings.referrerId, referrers.id))
      .leftJoin(examinees, eq(bookings.examineeId, examinees.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(bookings.dateTime))
      .limit(limit);

    // Reshape the flattened data into the expected structure
    const results = rows.map((row) => ({
      id: row.id,
      organizationId: row.organizationId,
      teamId: row.teamId,
      createdById: row.createdById,
      referrerId: row.referrerId,
      specialistId: row.specialistId,
      examineeId: row.examineeId,
      status: row.status,
      type: row.type,
      duration: row.duration,
      location: row.location,
      dateTime: row.dateTime,
      acuityAppointmentId: row.acuityAppointmentId,
      acuityAppointmentTypeId: row.acuityAppointmentTypeId,
      acuityCalendarId: row.acuityCalendarId,
      scheduledAt: row.scheduledAt,
      completedAt: row.completedAt,
      cancelledAt: row.cancelledAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      specialist: {
        id: row.specialistId_,
        name: row.specialistName,
        user: row.userId && row.userJobTitle ? {
          id: row.userId,
          jobTitle: row.userJobTitle,
        } : undefined,
      },
      referrer: row.referrerId_ && row.referrerFirstName && row.referrerLastName ? {
        id: row.referrerId_,
        firstName: row.referrerFirstName,
        lastName: row.referrerLastName,
      } : null,
      examinee: {
        id: row.examineeId_,
        firstName: row.examineeFirstName,
        lastName: row.examineeLastName,
        email: row.examineeEmail,
      },
    }));

    // Calendar queries don't use pagination, but return data in same format
    return {
      data: results,
      // Optional pagination field for compatibility
      pagination: undefined
    };
  }

  // Helper method to build common filter conditions
  private buildFilterConditions(filters?: BookingFilters, baseConditions: SQL[] = []): SQL[] {
    const conditions = [...baseConditions];

    if (filters?.status) {
      conditions.push(eq(bookings.status, filters.status as "active" | "closed" | "archived"));
    }
    if (filters?.startDate) {
      conditions.push(gte(bookings.dateTime, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(bookings.dateTime, filters.endDate));
    }

    // Handle both single specialistId and multiple specialistIds
    if (filters?.specialistIds && filters.specialistIds.length > 0) {
      conditions.push(inArray(bookings.specialistId, filters.specialistIds));
    } else if (filters?.specialistId) {
      conditions.push(eq(bookings.specialistId, filters.specialistId));
    }

    // Handle search across examinee fields using SQL ILIKE (case-insensitive)
    // Now that fields are no longer encrypted, we can use SQL ILIKE for efficient searching
    if (filters?.search) {
      const searchTerm = `%${filters.search.trim()}%`;
      conditions.push(
        or(
          ilike(examinees.email, searchTerm),
          ilike(examinees.firstName, searchTerm),
          ilike(examinees.lastName, searchTerm),
          sql`CONCAT(${examinees.firstName}, ' ', ${examinees.lastName}) ILIKE ${searchTerm}`
        )!
      );
    }

    return conditions;
  }

  // Helper method to build paginated query with specialist join
  // Optimized for list view - only loads essential fields
  // Search filtering now happens in SQL via buildFilterConditions (ILIKE)
  private async getPaginatedBookings(conditions: SQL[], filters?: BookingFilters) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const offset = (page - 1) * limit;

    // Fetch booking IDs with joins
    const results = await db
      .select({ id: bookings.id })
      .from(bookings)
      .leftJoin(examinees, eq(bookings.examineeId, examinees.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(bookings.createdAt))
      .limit(limit)
      .offset(offset);

    // Get the booking IDs from the results
    const bookingIds = results.map((r) => r.id);

    // Build count query for pagination
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(bookings)
      .leftJoin(examinees, eq(bookings.examineeId, examinees.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    // If no results, return empty with pagination
    if (bookingIds.length === 0) {
      return {
        data: [],
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(Number(count) / limit),
        },
      };
    }

    // Fetch optimized booking details with only essential fields
    const fullResults = await db.query.bookings.findMany({
      where: inArray(bookings.id, bookingIds),
      orderBy: desc(bookings.createdAt),
      with: {
        specialist: {
          columns: {
            id: true,
            name: true,
          },
          with: {
            user: {
              columns: {
                id: true,
                jobTitle: true,
              },
            },
          },
        },
        referrer: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
          with: {
            organization: {
              columns: {
                id: true,
                name: true,
              },
            },
          },
        },
        examinee: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phoneNumber: true,
            condition: true,
            caseType: true,
          },
        },
      },
    });

    return {
      data: fullResults,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(Number(count) / limit),
      },
    };
  }

  async findByIdWithDetails(id: string) {
    const result = await db.query.bookings.findFirst({
      where: eq(bookings.id, id),
      with: {
        specialist: {
          with: { user: true },
        },
        referrer: {
          with: { organization: true },
        },
        examinee: true,
        createdBy: true,
        organization: true,
      },
    });

    return result;
  }

  async findAllForAdmin(filters?: BookingFilters) {
    const conditions = this.buildFilterConditions(filters);
    return this.getPaginatedBookings(conditions, filters);
  }

  async findForReferrer(userId: string, filters?: BookingFilters) {
    const baseConditions = [eq(bookings.referrerId, userId)];
    const conditions = this.buildFilterConditions(filters, baseConditions);
    return this.getPaginatedBookings(conditions, filters);
  }

  async findForSpecialist(specialistId: string, filters?: BookingFilters) {
    const baseConditions = [eq(bookings.specialistId, specialistId)];
    const conditions = this.buildFilterConditions(filters, baseConditions);
    return this.getPaginatedBookings(conditions, filters);
  }

  async findForOrganization(organizationId: string, filters?: BookingFilters) {
    const baseConditions = [eq(bookings.organizationId, organizationId)];
    const conditions = this.buildFilterConditions(filters, baseConditions);
    // Note: teamId field not in current schema, will need to be added if team filtering is required
    return this.getPaginatedBookings(conditions, filters);
  }

  // Note: Team-based filtering would require teamId field in bookings table
  // This method is a placeholder for future implementation
  async findForTeams(teamIds: string[], filters?: BookingFilters) {
    // TODO: Implement team-based filtering when teamId is added to bookings schema
    // For now, return empty results
    const conditions = this.buildFilterConditions(filters);
    return this.getPaginatedBookings(conditions, filters);
  }

  // Calendar-optimized query methods
  async findAllForAdminCalendar(filters?: BookingFilters) {
    const conditions = this.buildFilterConditions(filters);
    return this.findForCalendar(conditions, filters);
  }

  async findForReferrerCalendar(userId: string, filters?: BookingFilters) {
    const baseConditions = [eq(bookings.referrerId, userId)];
    const conditions = this.buildFilterConditions(filters, baseConditions);
    return this.findForCalendar(conditions, filters);
  }

  async findForSpecialistCalendar(specialistId: string, filters?: BookingFilters) {
    const baseConditions = [eq(bookings.specialistId, specialistId)];
    const conditions = this.buildFilterConditions(filters, baseConditions);
    return this.findForCalendar(conditions, filters);
  }

  async findForOrganizationCalendar(organizationId: string, filters?: BookingFilters) {
    const baseConditions = [eq(bookings.organizationId, organizationId)];
    const conditions = this.buildFilterConditions(filters, baseConditions);
    return this.findForCalendar(conditions, filters);
  }
}

export const bookingRepository = new BookingRepository();
