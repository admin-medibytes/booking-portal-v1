import { auth } from "@/lib/auth";
import { auditService } from "./audit.service";
import { logger } from "@/server/utils/logger";
import { HTTPException } from "hono/http-exception";
import { db } from "@/server/db";
import { organizations, members, teams } from "@/server/db/schema";

interface CreateOrganizationDto {
  name: string;
  slug: string;
  logo?: string;
  contactEmail?: string;
  phone?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  createdBy: string;
}

interface UpdateOrganizationDto {
  name?: string;
  logo?: string;
  contactEmail?: string;
  phone?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
}

interface ListOrganizationsParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: "active" | "inactive";
}

interface OrganizationData {
  id: string;
  name: string;
  slug: string;
  metadata?: {
    isActive?: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface CreateTeamDto {
  name: string;
  organizationId: string;
  createdBy: string;
}

export class OrganizationService {
  async createOrganization(data: CreateOrganizationDto, headers: HeadersInit) {
    try {
      const organization = await auth.api.createOrganization({
        headers,
        body: {
          name: data.name,
          slug: data.slug,
          logo: data.logo,
        },
      });

      if (organization === null) {
        throw new HTTPException(400, { message: "Failed to create organization" });
      }

      const defaultTeam = await auth.api.listOrganizationTeams({
        headers,
      });

      logger.info("Organization created with default team", {
        organizationId: organization.id,
        teamId: defaultTeam[0].id,
      });

      return organization;
    } catch (error) {
      logger.error("Failed to create organization", error as Error, {
        createdBy: data.createdBy,
        data,
      });
      if (error instanceof HTTPException) {
        throw error;
      }
      throw new HTTPException(500, { message: "Failed to create organization" });
    }
  }

  async listOrganizations(params: ListOrganizationsParams, headers: HeadersInit) {
    try {
      const { page = 1, limit = 20, search, status } = params;

      const response = await auth.api.listOrganizations({
        headers,
        query: {
          limit: limit.toString(),
          offset: ((page - 1) * limit).toString(),
        },
      });

      let organizations = response || [];

      if (search) {
        const searchLower = search.toLowerCase();
        organizations = organizations.filter(
          (org: OrganizationData) =>
            org.name.toLowerCase().includes(searchLower) ||
            org.slug.toLowerCase().includes(searchLower)
        );
      }

      if (status === "inactive") {
        organizations = organizations.filter(
          (org: OrganizationData) => org.metadata?.isActive === false
        );
      } else if (status === "active") {
        organizations = organizations.filter(
          (org: OrganizationData) => org.metadata?.isActive !== false
        );
      }

      const enrichedOrgs = await Promise.all(
        organizations.map(async (org: OrganizationData) => {
          const membersResponse = await auth.api.listMembers({
            headers,
            query: {
              organizationId: org.id,
            },
          });

          const teamsResponse = await auth.api.listOrganizationTeams({
            headers,
            query: {
              organizationId: org.id,
            },
          });

          return {
            ...org,
            memberCount: membersResponse.members?.length || 0,
            teamCount: teamsResponse?.length || 0,
            address: org.address
              ? typeof org.address === "string"
                ? JSON.parse(org.address)
                : org.address
              : null,
          };
        })
      );

      return {
        organizations: enrichedOrgs,
        pagination: {
          page,
          limit,
          total: enrichedOrgs.length,
          totalPages: Math.ceil(enrichedOrgs.length / limit),
        },
      };
    } catch (error) {
      logger.error("Failed to list organizations", error as Error);
      throw new HTTPException(500, { message: "Failed to list organizations" });
    }
  }

  async listAllOrganizations(params: ListOrganizationsParams) {
    try {
      const { page = 1, limit = 20, search, status } = params;
      const offset = (page - 1) * limit;

      // Query all organizations from database (admin access)
      const { eq, ilike, or, sql } = await import("drizzle-orm");

      let query = db.select().from(organizations);

      // Apply search filter
      if (search) {
        const searchLower = `%${search.toLowerCase()}%`;
        query = query.where(
          or(
            ilike(organizations.name, searchLower),
            ilike(organizations.slug, searchLower)
          )
        ) as typeof query;
      }

      // Apply status filter if provided
      if (status === "inactive") {
        query = query.where(sql`${organizations.metadata}->>'isActive' = 'false'`) as typeof query;
      } else if (status === "active") {
        query = query.where(
          or(
            sql`${organizations.metadata}->>'isActive' = 'true'`,
            sql`${organizations.metadata}->>'isActive' IS NULL`
          )
        ) as typeof query;
      }

      // Get total count for pagination
      const allOrgs = await query;
      const total = allOrgs.length;

      // Apply pagination
      const organizationsList = allOrgs.slice(offset, offset + limit);

      // Enrich with member and team counts
      const enrichedOrgs = await Promise.all(
        organizationsList.map(async (org) => {
          const memberCount = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(members)
            .where(eq(members.organizationId, org.id));

          const teamCount = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(teams)
            .where(eq(teams.organizationId, org.id));

          return {
            id: org.id,
            name: org.name,
            slug: org.slug,
            logo: org.logo,
            metadata: org.metadata,
            createdAt: org.createdAt,
            memberCount: memberCount[0]?.count || 0,
            teamCount: teamCount[0]?.count || 0,
          };
        })
      );

      return {
        organizations: enrichedOrgs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error("Failed to list all organizations (admin)", error as Error);
      throw new HTTPException(500, { message: "Failed to list all organizations" });
    }
  }

  async getOrganizationBySlug(slug: string, headers: HeadersInit) {
    const response = await auth.api.getFullOrganization({
      headers,
      query: { organizationSlug: slug },
    });

    if (!response) {
      throw new HTTPException(404, { message: "Organization not found" });
    }

    return response;
  }

  async getOrganizationWithStats(organizationId: string, headers: HeadersInit) {
    try {
      const response = await auth.api.getFullOrganization({
        headers,
        query: {
          organizationId,
        },
      });

      if (!response) {
        throw new HTTPException(404, { message: "Organization not found" });
      }

      const teamsResponse = await auth.api.listOrganizationTeams({
        headers,
        query: {
          organizationId,
        },
      });

      const auditLogs = await auditService.getLogsForResource("organization", organizationId);

      return {
        ...response,
        members: response?.members || [],
        invitations: response?.invitations || [],
        teams: teamsResponse || [],
        teamCount: teamsResponse?.length || 0,
        memberCount: response?.members?.length || 0,
        address: response?.address ? JSON.parse(response.address as string) : null,
        auditHistory: auditLogs,
      };
    } catch (error) {
      logger.error("Failed to get organization details", error as Error, {
        organizationId,
      });
      if (error instanceof HTTPException) throw error;
      throw new HTTPException(500, { message: "Failed to get organization details" });
    }
  }

  async updateOrganization(
    organizationId: string,
    data: UpdateOrganizationDto,
    updatedBy: string,
    headers: HeadersInit
  ) {
    try {
      // Only update basic fields supported by Better Auth
      const updateData: Record<string, unknown> = {};

      if (data.name !== undefined) updateData.name = data.name;
      if (data.logo !== undefined) updateData.logo = data.logo;

      const response = await auth.api.updateOrganization({
        headers,
        body: {
          data: updateData,
          organizationId,
        },
        query: {
          organizationId,
        },
      });

      if (!response) {
        throw new HTTPException(400, { message: "Failed to update organization" });
      }

      await auditService.log({
        userId: updatedBy,
        action: "organization.updated",
        resourceType: "organization",
        resourceId: organizationId,
        metadata: {
          changes: Object.keys(data),
        },
      });

      return response;
    } catch (error) {
      logger.error("Failed to update organization", error as Error, {
        organizationId,
        updatedBy,
        data,
      });
      if (error instanceof HTTPException) throw error;
      throw new HTTPException(500, { message: "Failed to update organization" });
    }
  }

  async deleteOrganization(organizationId: string, deletedBy: string, headers: HeadersInit) {
    try {
      const orgResponse = await auth.api.getFullOrganization({
        headers,
        query: {
          organizationId,
        },
      });

      if (!orgResponse) {
        throw new HTTPException(404, { message: "Organization not found" });
      }

      const response = await auth.api.deleteOrganization({
        headers,
        body: {
          organizationId,
        },
      });

      await auditService.log({
        userId: deletedBy,
        action: "organization.deleted",
        resourceType: "organization",
        resourceId: organizationId,
        metadata: {
          organizationName: orgResponse?.name || "Unknown",
        },
      });

      return response;
    } catch (error) {
      logger.error("Failed to delete organization", error as Error, {
        organizationId,
        deletedBy,
      });
      if (error instanceof HTTPException) throw error;
      throw new HTTPException(500, { message: "Failed to delete organization" });
    }
  }

  async checkSlugAvailability(slug: string, headers: HeadersInit) {
    try {
      const response = await auth.api.checkOrganizationSlug({
        headers,
        body: {
          slug,
        },
      });

      return response.status;
    } catch (error) {
      logger.error("Failed to check slug availability", error as Error, {
        slug,
      });
      return false;
    }
  }

  async createTeam(data: CreateTeamDto, headers: HeadersInit) {
    try {
      const response = await auth.api.createTeam({
        headers,
        body: {
          name: data.name,
          organizationId: data.organizationId,
        },
      });

      if (!response) {
        throw new HTTPException(400, { message: "Failed to create team" });
      }

      await auditService.log({
        userId: data.createdBy,
        action: "team.created",
        resourceType: "team",
        resourceId: response.id,
        metadata: {
          name: data.name,
          organizationId: data.organizationId,
        },
      });

      return response;
    } catch (error) {
      logger.error("Failed to create team", error as Error, {
        organizationId: data.organizationId,
        createdBy: data.createdBy,
        data,
      });
      if (error instanceof HTTPException) throw error;
      throw new HTTPException(500, { message: "Failed to create team" });
    }
  }

  async listTeams(organizationId: string, headers: HeadersInit) {
    try {
      const response = await auth.api.listOrganizationTeams({
        headers,
        query: {
          organizationId,
        },
      });

      return response || [];
    } catch (error) {
      logger.error("Failed to list teams", error as Error, {
        organizationId,
      });
      throw new HTTPException(500, { message: "Failed to list teams" });
    }
  }

  async updateTeam(teamId: string, name: string, updatedBy: string, headers: HeadersInit) {
    try {
      const response = await auth.api.updateTeam({
        headers,
        body: {
          teamId,
          data: {
            name,
          },
        },
      });

      if (!response) {
        throw new HTTPException(400, { message: "Failed to update team" });
      }

      await auditService.log({
        userId: updatedBy,
        action: "team.updated",
        resourceType: "team",
        resourceId: teamId,
        metadata: {
          name,
        },
      });

      return response;
    } catch (error) {
      logger.error("Failed to update team", error as Error, {
        teamId,
        updatedBy,
      });
      if (error instanceof HTTPException) throw error;
      throw new HTTPException(500, { message: "Failed to update team" });
    }
  }

  async deleteTeam(teamId: string, deletedBy: string, headers: HeadersInit) {
    try {
      const response = await auth.api.removeTeam({
        headers,
        body: {
          teamId,
        },
      });

      await auditService.log({
        userId: deletedBy,
        action: "team.deleted",
        resourceType: "team",
        resourceId: teamId,
      });

      return response;
    } catch (error) {
      logger.error("Failed to delete team", error as Error, {
        teamId,
        deletedBy,
      });
      if (error instanceof HTTPException) throw error;
      throw new HTTPException(500, { message: "Failed to delete team" });
    }
  }
}

export const organizationService = new OrganizationService();
