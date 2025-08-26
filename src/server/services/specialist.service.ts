import { specialistRepository } from "@/server/repositories/specialist.repository";
import { logger } from "@/server/utils/logger";
import { AppError, ErrorCode } from "@/server/utils/errors";
import type { User } from "@/types/user";
import type { Specialist, SpecialistLocation } from "@/types/specialist";

export interface SpecialistWithUser {
  specialist: Specialist;
  user: Pick<User, "id" | "email" | "firstName" | "lastName" | "jobTitle">;
}

export interface AdminSpecialistListOptions {
  includeInactive?: boolean;
}

export interface AdminSpecialistListItem {
  id: string;
  userId: string;
  acuityCalendarId: string;
  name: string;
  slug: string;
  location: SpecialistLocation | null;
  acceptsInPerson: boolean;
  acceptsTelehealth: boolean;
  position: number;
  isActive: boolean;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    jobTitle: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export class SpecialistService {
  /**
   * Get all specialists for admin view with full user details
   */
  async getAdminSpecialistList(
    adminUserId: string,
    options: AdminSpecialistListOptions = {}
  ): Promise<AdminSpecialistListItem[]> {
    try {
      const { includeInactive = false } = options;

      // Audit log the access
      logger.audit("admin_view_specialist_list", adminUserId, "specialist", "list", {
        includeInactive,
      });

      // Fetch specialists based on active status preference
      const specialists = includeInactive
        ? await specialistRepository.findAll()
        : await specialistRepository.findAllActive();

      // Transform to admin response format
      return specialists.map(({ specialist, user }) => ({
        id: specialist.id,
        userId: specialist.userId,
        acuityCalendarId: specialist.acuityCalendarId,
        name: specialist.name,
        slug: specialist.slug,
        location: specialist.location,
        acceptsInPerson: specialist.acceptsInPerson,
        acceptsTelehealth: specialist.acceptsTelehealth,
        position: specialist.position,
        isActive: specialist.isActive,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          jobTitle: user.jobTitle,
        },
        createdAt: specialist.createdAt,
        updatedAt: specialist.updatedAt,
      }));
    } catch (error) {
      logger.error("Failed to list specialists for admin", error as Error);
      throw new AppError(ErrorCode.INTERNAL_SERVER_ERROR, "Failed to retrieve specialists", 500, {
        error: (error as Error).message,
      });
    }
  }
}

// Export singleton instance
export const specialistService = new SpecialistService();
