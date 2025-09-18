import { db } from "@/server/db";
import { bookings, specialists, users, referrers, examinees, organizations } from "@/server/db/schema";
import { eq, and, gte, lte, desc, sql, SQL } from "drizzle-orm";
import type { BookingFilters } from "@/types/booking";

export class BookingRepository {
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
    if (filters?.specialistId) {
      conditions.push(eq(bookings.specialistId, filters.specialistId));
    }

    return conditions;
  }

  // Helper method to build paginated query with specialist join
  private async getPaginatedBookings(conditions: SQL[], filters?: BookingFilters) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const offset = (page - 1) * limit;

    const query = db
      .select({
        booking: bookings,
        specialist: specialists,
        specialistUser: users,
        referrer: referrers,
        examinee: examinees,
        referrerOrganization: organizations,
      })
      .from(bookings)
      .leftJoin(specialists, eq(bookings.specialistId, specialists.id))
      .leftJoin(users, eq(specialists.userId, users.id))
      .leftJoin(referrers, eq(bookings.referrerId, referrers.id))
      .leftJoin(examinees, eq(bookings.examineeId, examinees.id))
      .leftJoin(organizations, eq(referrers.organizationId, organizations.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(bookings.createdAt))
      .limit(limit)
      .offset(offset);

    const results = await query;

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(bookings)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return {
      data: results,
      pagination: {
        page,
        limit,
        total: Number(count),
        totalPages: Math.ceil(Number(count) / limit),
      },
    };
  }
  async findByIdWithSpecialist(id: string) {
    const result = await db.query.bookings.findFirst({
      where: eq(bookings.id, id),
      with: {
        specialist: {
          with: {
            user: true,
          }
        },
        referrer: {
          with: {
            organization: true,
          }
        },
        examinee: true,
        organization: true,
      }
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
}

export const bookingRepository = new BookingRepository();
