import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { users, organizations, members, invitations, teams, specialists } from "@/server/db/schema";
import { eq, and, or, like, count, sql, inArray } from "drizzle-orm";
import { logger } from "@/server/utils/logger";
import { AppError, ErrorCode, ConflictError, NotFoundError } from "@/server/utils/errors";
import { emailService } from "@/server/services/email.service";
import { env } from "@/lib/env";
import { auditService } from "@/server/services/audit.service";
import type {
  CreateUserInput,
  UserListParams,
  UserListResponse,
  User,
  UserWithMemberships,
  UpdateUserInput,
  UserDetailsResponse,
} from "@/types/user";

export class UserService {
  async createUserWithMembership(
    input: CreateUserInput,
    headers: HeadersInit
  ): Promise<UserWithMemberships> {
    try {
      // Check if user already exists
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      if (existingUser.length > 0) {
        throw new ConflictError("User with this email already exists", { email: input.email });
      }

      // Validate organization and team
      const [org, team] = await Promise.all([
        db.select().from(organizations).where(eq(organizations.id, input.organizationId)).limit(1),
        db.select().from(teams).where(eq(teams.id, input.teamId)).limit(1),
      ]);

      if (org.length === 0) {
        throw new NotFoundError("Organization", input.organizationId);
      }

      if (team.length === 0) {
        throw new NotFoundError("Team", input.teamId);
      }

      if (team[0].organizationId !== org[0].id) {
        throw new AppError(ErrorCode.VALIDATION_FAILED, "Team is not in the organization", 400);
      }

      // Validate specialist requirements if role is specialist
      if (input.role === "specialist") {
        if (!input.acuityCalendarId) {
          throw new AppError(
            ErrorCode.VALIDATION_FAILED,
            "Acuity Calendar ID is required for specialists",
            400
          );
        }
        if (!input.slug) {
          throw new AppError(ErrorCode.VALIDATION_FAILED, "Slug is required for specialists", 400);
        }
      }

      if (input.acuityCalendarId) {
        const existingSpecialist = await db
          .select()
          .from(specialists)
          .where(eq(specialists.acuityCalendarId, input.acuityCalendarId))
          .limit(1);

        if (existingSpecialist.length > 0) {
          throw new ConflictError("A specialist with this Acuity Calendar ID already exists");
        }
      }

      // Check slug uniqueness for specialists
      if (input.role === "specialist" && input.slug) {
        const existingSlug = await db
          .select()
          .from(specialists)
          .where(eq(specialists.slug, input.slug))
          .limit(1);

        if (existingSlug.length > 0) {
          throw new ConflictError("A specialist with this slug already exists");
        }
      }

      // Start transaction
      const result = await db.transaction(async (tx) => {
        // Create user with Better Auth
        const tempPassword = this.generateTempPassword();
        const name = `${input.firstName} ${input.lastName}`;
        const authResult = await auth.api.createUser({
          headers,
          body: {
            email: input.email,
            password: tempPassword,
            name,
            data: {
              firstName: input.firstName,
              lastName: input.lastName,
              jobTitle: input.jobTitle || "N/A",
            },
            role: input.role === "admin" ? "admin" : "user",
          },
        });

        if (!authResult?.user) {
          throw new AppError(ErrorCode.INTERNAL_SERVER_ERROR, "Failed to create user", 500);
        }

        const userId = authResult.user.id;

        // Create member record
        await tx.insert(members).values({
          id: crypto.randomUUID(),
          userId,
          organizationId: input.organizationId,
          role: input.role === "admin" ? "manager" : input.role,
          createdAt: new Date(),
        });

        // If specialist, create specialist record
        if (input.role === "specialist" && input.acuityCalendarId) {
          // Get the highest position for auto-assignment
          const maxPositionResult = await tx
            .select({ maxPosition: sql<number>`COALESCE(MAX(${specialists.position}), 0)` })
            .from(specialists);
          const position = (maxPositionResult[0]?.maxPosition ?? 0) + 1;

          await tx.insert(specialists).values({
            userId,
            acuityCalendarId: input.acuityCalendarId,
            name,
            slug: input.slug!,
            location: null,
            position,
            isActive: true,
          });
        }

        // Send invitation email if requested
        if (input.sendEmailInvitation) {
          const invitationId = crypto.randomUUID();
          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

          await tx.insert(invitations).values({
            id: invitationId,
            email: input.email,
            organizationId: input.organizationId,
            role: input.role === "admin" ? "manager" : input.role,
            teamId: input.teamId,
            status: "pending",
            expiresAt,
            inviterId: input.createdBy,
          });

          await emailService.sendInvitationEmail({
            email: input.email,
            inviterName: "Admin",
            inviterEmail: "admin@medibytes.com",
            organizationName: org[0].name,
            inviteLink: `${env.APP_URL}/accept-invitation/${invitationId}`,
            expiresAt,
          });
        }

        // Log audit event
        await auditService.log({
          action: "user.created",
          userId: input.createdBy,
          targetId: userId,
          metadata: {
            email: input.email,
            role: input.role,
            organizationId: input.organizationId,
            teamId: input.teamId,
          },
        });

        return authResult.user;
      });

      // Return user with memberships
      return await this.getUserDetails(result.id);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error("Failed to create user with membership", error as Error);
      throw new AppError(ErrorCode.INTERNAL_SERVER_ERROR, "Failed to create user", 500);
    }
  }

  async listUsersWithMemberships(params: UserListParams): Promise<UserListResponse> {
    try {
      const page = params.page || 1;
      const limit = params.limit || 20;
      const offset = (page - 1) * limit;

      // Build where conditions
      const whereConditions = [];

      if (params.search) {
        whereConditions.push(
          or(
            like(users.email, `%${params.search}%`),
            like(users.firstName, `%${params.search}%`),
            like(users.lastName, `%${params.search}%`)
          )
        );
      }

      if (params.status === "active") {
        whereConditions.push(or(eq(users.banned, false), sql`${users.banned} IS NULL`));
      } else if (params.status === "inactive") {
        whereConditions.push(eq(users.banned, true));
      }

      const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

      // Get users with pagination
      const [userList, _totalCount] = await Promise.all([
        db
          .select()
          .from(users)
          .where(whereClause)
          .limit(limit)
          .offset(offset)
          .orderBy(users.createdAt),
        db.select({ count: count() }).from(users).where(whereClause),
      ]);

      // Get memberships for each user
      const userIds = userList.map((u) => u.id);

      const [membershipsData, specialistsData] = await Promise.all([
        userIds.length > 0
          ? db
              .select({
                userId: members.userId,
                organizationId: members.organizationId,
                organizationName: organizations.name,
                role: members.role,
                joinedAt: members.createdAt,
              })
              .from(members)
              .innerJoin(organizations, eq(members.organizationId, organizations.id))
              .where(inArray(members.userId, userIds))
          : [],
        userIds.length > 0
          ? db.select().from(specialists).where(inArray(specialists.userId, userIds))
          : [],
      ]);

      // Map specialists by userId
      const specialistsByUserId = new Map(specialistsData.map((s) => [s.userId, s]));

      // Map memberships by userId
      const membershipsByUserId = new Map<string, (typeof membershipsData)[0][]>();
      membershipsData.forEach((m) => {
        if (!membershipsByUserId.has(m.userId)) {
          membershipsByUserId.set(m.userId, []);
        }
        membershipsByUserId.get(m.userId)!.push(m);
      });

      // Filter by role if specified
      let filteredUserList = userList;
      if (params.role) {
        const usersWithRole = membershipsData
          .filter((m) => m.role === params.role)
          .map((m) => m.userId);
        filteredUserList = userList.filter((u) => usersWithRole.includes(u.id));
      }

      // Filter by organization if specified
      if (params.organizationId) {
        const usersInOrg = membershipsData
          .filter((m) => m.organizationId === params.organizationId)
          .map((m) => m.userId);
        filteredUserList = filteredUserList.filter((u) => usersInOrg.includes(u.id));
      }

      // Build response
      const usersWithMemberships: UserWithMemberships[] = filteredUserList.map((user) => {
        const userMemberships = membershipsByUserId.get(user.id) || [];
        const specialist = specialistsByUserId.get(user.id);

        return {
          ...user,
          memberships: userMemberships.map((m) => ({
            organizationId: m.organizationId,
            organizationName: m.organizationName,
            teamId: undefined, // Will be added when team relationship is implemented
            teamName: undefined,
            role: m.role || "",
            joinedAt: m.joinedAt,
          })),
          specialist: specialist
            ? {
                id: specialist.id,
                acuityCalendarId: specialist.acuityCalendarId,
                position: specialist.position,
                location: specialist.location,
              }
            : undefined,
        };
      });

      return {
        users: usersWithMemberships,
        pagination: {
          total: filteredUserList.length,
          page,
          pageSize: limit,
          totalPages: Math.ceil(filteredUserList.length / limit),
        },
      };
    } catch (error) {
      logger.error("Failed to list users with memberships", error as Error);
      throw new AppError(ErrorCode.INTERNAL_SERVER_ERROR, "Failed to list users", 500);
    }
  }

  async getUserDetails(userId: string): Promise<UserDetailsResponse> {
    try {
      const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);

      if (user.length === 0) {
        throw new NotFoundError("User", userId);
      }

      // Get memberships
      const membershipsData = await db
        .select({
          organizationId: members.organizationId,
          organizationName: organizations.name,
          role: members.role,
          joinedAt: members.createdAt,
        })
        .from(members)
        .innerJoin(organizations, eq(members.organizationId, organizations.id))
        .where(eq(members.userId, userId));

      // Get specialist data if applicable
      const specialistData = await db
        .select()
        .from(specialists)
        .where(eq(specialists.userId, userId))
        .limit(1);

      // Get audit history
      const auditHistory = await auditService.getUserAuditHistory(userId);

      return {
        ...user[0],
        memberships: membershipsData.map((m) => ({
          organizationId: m.organizationId,
          organizationName: m.organizationName,
          teamId: undefined,
          teamName: undefined,
          role: m.role || "",
          joinedAt: m.joinedAt,
        })),
        specialist: specialistData[0]
          ? {
              id: specialistData[0].id,
              acuityCalendarId: specialistData[0].acuityCalendarId,
              position: specialistData[0].position,
              location: specialistData[0].location,
            }
          : undefined,
        auditHistory: auditHistory.map(
          (a: { action: string; createdAt: Date; userId?: string; changes?: unknown }) => ({
            action: a.action,
            timestamp: a.createdAt,
            performedBy: a.userId || "system",
            details: a.changes || {},
          })
        ),
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error("Failed to get user details", error as Error);
      throw new AppError(ErrorCode.INTERNAL_SERVER_ERROR, "Failed to get user details", 500);
    }
  }

  async updateUser(userId: string, input: UpdateUserInput): Promise<User> {
    try {
      const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);

      if (user.length === 0) {
        throw new NotFoundError("User", userId);
      }

      const updates: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (input.firstName) updates.firstName = input.firstName;
      if (input.lastName) updates.lastName = input.lastName;
      if (input.phone) updates.phoneNumber = input.phone;
      if (input.jobTitle) updates.jobTitle = input.jobTitle;
      if (input.firstName && input.lastName) {
        updates.name = `${input.firstName} ${input.lastName}`;
      }

      const [updatedUser] = await db
        .update(users)
        .set(updates)
        .where(eq(users.id, userId))
        .returning();

      await auditService.log({
        action: "user.updated",
        userId,
        targetId: userId,
        metadata: {
          ...input,
        },
      });

      logger.info("User updated", {
        userId,
        updates: Object.keys(input),
      });

      return updatedUser;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error("Failed to update user", error as Error);
      throw new AppError(ErrorCode.INTERNAL_SERVER_ERROR, "Failed to update user", 500);
    }
  }

  async updateUserStatus(userId: string, isActive: boolean, updatedBy: string): Promise<void> {
    try {
      const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);

      if (user.length === 0) {
        throw new NotFoundError("User", userId);
      }

      await db
        .update(users)
        .set({
          banned: !isActive,
          banReason: !isActive ? "Deactivated by admin" : null,
          banExpires: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      // Update specialist status if applicable
      await db
        .update(specialists)
        .set({
          isActive,
          updatedAt: new Date(),
        })
        .where(eq(specialists.userId, userId));

      await auditService.log({
        action: isActive ? "user.activated" : "user.deactivated",
        userId: updatedBy,
        targetId: userId,
        metadata: { isActive },
      });

      logger.info("User status updated", {
        userId,
        isActive,
        updatedBy,
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error("Failed to update user status", error as Error);
      throw new AppError(ErrorCode.INTERNAL_SERVER_ERROR, "Failed to update user status", 500);
    }
  }

  async sendInvitationEmail(userId: string, sentBy: string): Promise<void> {
    try {
      const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);

      if (user.length === 0) {
        throw new NotFoundError("User", userId);
      }

      // Get user's organization
      const membership = await db
        .select({
          organizationName: organizations.name,
        })
        .from(members)
        .innerJoin(organizations, eq(members.organizationId, organizations.id))
        .where(eq(members.userId, userId))
        .limit(1);

      const invitationId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await emailService.sendInvitationEmail({
        email: user[0].email,
        inviterName: "Admin",
        inviterEmail: "admin@medibytes.com",
        organizationName: membership[0]?.organizationName || "MediBytes",
        inviteLink: `${env.APP_URL}/reset-password?token=${invitationId}`,
        expiresAt,
      });

      await auditService.log({
        action: "user.invitation_sent",
        userId: sentBy,
        targetId: userId,
        metadata: { email: user[0].email },
      });

      logger.info("Invitation email sent", {
        userId,
        email: user[0].email,
        sentBy,
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error("Failed to send invitation email", error as Error);
      throw new AppError(ErrorCode.INTERNAL_SERVER_ERROR, "Failed to send invitation email", 500);
    }
  }

  async getOrganizationTeams(organizationId: string) {
    try {
      const teamsList = await db
        .select({
          id: teams.id,
          name: teams.name,
        })
        .from(teams)
        .where(eq(teams.organizationId, organizationId))
        .orderBy(teams.name);

      return teamsList;
    } catch (error) {
      logger.error("Failed to get organization teams", error as Error);
      throw new AppError(ErrorCode.INTERNAL_SERVER_ERROR, "Failed to get organization teams", 500);
    }
  }

  // Keep existing methods for backward compatibility
  async createUser(input: CreateUserInput, headers: HeadersInit): Promise<User> {
    // This method is kept for backward compatibility
    // It delegates to the new createUserWithMembership method
    return this.createUserWithMembership(
      {
        ...input,
        sendEmailInvitation: false,
        createdBy: "system",
      } as CreateUserInput,
      headers
    );
  }

  async listUsers(params: UserListParams): Promise<{
    users: UserWithMemberships[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    // This method is kept for backward compatibility
    const result = await this.listUsersWithMemberships(params);
    return {
      users: result.users,
      total: result.pagination.total,
      page: result.pagination.page,
      pageSize: result.pagination.pageSize,
      totalPages: result.pagination.totalPages,
    };
  }

  async resendInvitation(userId: string, adminUserId: string): Promise<void> {
    await this.sendInvitationEmail(userId, adminUserId);
  }

  async inviteUser(input: {
    email: string;
    role: "referrer" | "specialist";
    organizationId: string;
    teamId?: string;
    firstName?: string;
    lastName?: string;
    jobTitle?: string;
    invitedBy: { id: string; name: string; email: string };
  }) {
    try {
      // Check if user already exists
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      if (existingUser.length > 0) {
        // Check if already invited to this organization
        const existingInvite = await db
          .select()
          .from(invitations)
          .where(
            and(
              eq(invitations.email, input.email),
              eq(invitations.organizationId, input.organizationId),
              eq(invitations.status, "pending")
            )
          )
          .limit(1);

        if (existingInvite.length > 0) {
          throw new ConflictError("User already has a pending invitation to this organization");
        }
      }

      // Validate organization exists
      const org = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, input.organizationId))
        .limit(1);

      if (org.length === 0) {
        throw new NotFoundError("Organization", input.organizationId);
      }

      // Create invitation
      const invitationId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await db.insert(invitations).values({
        id: invitationId,
        email: input.email,
        organizationId: input.organizationId,
        role: input.role,
        teamId: input.teamId,
        status: "pending",
        expiresAt,
        inviterId: input.invitedBy.id,
      });

      // Send invitation email
      await emailService.sendInvitationEmail({
        email: input.email,
        inviterName: input.invitedBy.name,
        inviterEmail: input.invitedBy.email,
        organizationName: org[0].name,
        inviteLink: `${env.APP_URL}/accept-invitation/${invitationId}`,
        expiresAt,
      });

      logger.info("User invitation sent", {
        invitationId,
        email: input.email,
        organizationId: input.organizationId,
        role: input.role,
        invitedBy: input.invitedBy.id,
      });

      return {
        id: invitationId,
        email: input.email,
        organizationId: input.organizationId,
        role: input.role,
        expiresAt,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error("Failed to invite user", error as Error);
      throw new AppError(ErrorCode.INTERNAL_SERVER_ERROR, "Failed to invite user", 500);
    }
  }

  async listInvitations(params: {
    organizationId?: string;
    status?: string;
    page: number;
    limit: number;
  }) {
    try {
      const offset = (params.page - 1) * params.limit;

      const whereConditions = [];
      if (params.organizationId) {
        whereConditions.push(eq(invitations.organizationId, params.organizationId));
      }
      if (params.status) {
        whereConditions.push(eq(invitations.status, params.status));
      }

      const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

      const [invitationList, totalCount] = await Promise.all([
        db
          .select({
            id: invitations.id,
            email: invitations.email,
            organizationId: invitations.organizationId,
            organizationName: organizations.name,
            role: invitations.role,
            teamId: invitations.teamId,
            status: invitations.status,
            expiresAt: invitations.expiresAt,
            inviterName: users.name,
            inviterEmail: users.email,
          })
          .from(invitations)
          .leftJoin(organizations, eq(invitations.organizationId, organizations.id))
          .leftJoin(users, eq(invitations.inviterId, users.id))
          .where(whereClause)
          .limit(params.limit)
          .offset(offset)
          .orderBy(invitations.expiresAt),
        db.select({ count: count() }).from(invitations).where(whereClause),
      ]);

      const total = totalCount[0]?.count || 0;
      const totalPages = Math.ceil(total / params.limit);

      return {
        invitations: invitationList,
        total,
        page: params.page,
        totalPages,
      };
    } catch (error) {
      logger.error("Failed to list invitations", error as Error);
      throw new AppError(ErrorCode.INTERNAL_SERVER_ERROR, "Failed to list invitations", 500);
    }
  }

  async acceptInvitation(input: {
    invitationId: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    jobTitle: string;
  }): Promise<{ userId: string }> {
    try {
      // Fetch and validate invitation
      const invitation = await db
        .select()
        .from(invitations)
        .where(and(eq(invitations.id, input.invitationId), eq(invitations.email, input.email)))
        .limit(1);

      if (invitation.length === 0) {
        throw new NotFoundError("Invitation", input.invitationId);
      }

      const invite = invitation[0];

      // Check if invitation is expired
      if (new Date() > invite.expiresAt) {
        throw new AppError(ErrorCode.INVITATION_EXPIRED, "Invitation has expired", 400);
      }

      // Check if invitation was already used
      if (invite.status !== "pending") {
        throw new AppError(
          ErrorCode.INVITATION_ALREADY_USED,
          "Invitation has already been used",
          400
        );
      }

      // Check if user already exists
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      if (existingUser.length > 0) {
        throw new ConflictError("User with this email already exists");
      }

      // Create the user account with Better Auth
      const result = await auth.api.createUser({
        headers: new Headers(),
        body: {
          email: input.email,
          password: input.password,
          name: `${input.firstName} ${input.lastName}`,
          data: {
            firstName: input.firstName,
            lastName: input.lastName,
            jobTitle: input.jobTitle,
          },
          role: "user", // Base role is always "user"
        },
      });

      if (!result?.user) {
        throw new AppError(ErrorCode.INTERNAL_SERVER_ERROR, "Failed to create user account", 500);
      }

      // Add user to organization as member with the specified role
      if (invite.organizationId) {
        await db.insert(members).values({
          id: crypto.randomUUID(),
          userId: result.user.id,
          organizationId: invite.organizationId,
          role: invite.role as "owner" | "manager" | "team_lead" | "referrer" | "specialist",
          createdAt: new Date(),
        });
      }

      // Update invitation status
      await db
        .update(invitations)
        .set({ status: "accepted" })
        .where(eq(invitations.id, input.invitationId));

      logger.info("Invitation accepted and user created", {
        invitationId: input.invitationId,
        userId: result.user.id,
        email: input.email,
        organizationRole: invite.role,
      });

      return { userId: result.user.id };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error("Failed to accept invitation", error as Error);
      throw new AppError(ErrorCode.INTERNAL_SERVER_ERROR, "Failed to accept invitation", 500);
    }
  }

  private generateTempPassword(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < 16; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }
}

export const userService = new UserService();
