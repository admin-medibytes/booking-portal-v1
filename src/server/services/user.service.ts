import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { users, organizations, members, invitations } from "@/server/db/schema";
import { eq, and, or, like, count } from "drizzle-orm";
import { logger } from "@/server/utils/logger";
import { AppError, ErrorCode, ConflictError, NotFoundError } from "@/server/utils/errors";
import { emailService } from "@/server/services/email.service";
import { env } from "@/lib/env";
import type { CreateUserInput, UserListParams, UserListResponse, User } from "@/types/user";

export class UserService {
  async createUser(input: CreateUserInput): Promise<User> {
    try {
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      if (existingUser.length > 0) {
        throw new ConflictError("User with this email already exists", { email: input.email });
      }

      const tempPassword = this.generateTempPassword();

      const result = await auth.api.createUser({
        headers: new Headers(),
        body: {
          email: input.email,
          password: tempPassword,
          name: input.name,
          data: {
            firstName: input.firstName,
            lastName: input.lastName,
            jobTitle: input.jobTitle,
          },
          role: input.role,
        },
      });

      if (!result?.user) {
        throw new AppError(ErrorCode.INTERNAL_SERVER_ERROR, "Failed to create user", 500);
      }

      if (input.organizationId && input.role !== "admin") {
        const org = await db
          .select()
          .from(organizations)
          .where(eq(organizations.id, input.organizationId))
          .limit(1);

        if (org.length === 0) {
          throw new NotFoundError("Organization", input.organizationId);
        }

        // Note: Organization invitations are handled separately through Better Auth's
        // organization invitation system. The admin will need to send an invitation
        // after creating the user.
      }

      logger.info("User created successfully", {
        userId: result.user.id,
        email: input.email,
        role: input.role,
      });

      return result.user as User;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error("Failed to create user", error as Error);
      throw new AppError(ErrorCode.INTERNAL_SERVER_ERROR, "Failed to create user", 500);
    }
  }

  async listUsers(params: UserListParams): Promise<UserListResponse> {
    try {
      const page = params.page || 1;
      const limit = params.limit || 20;
      const offset = (page - 1) * limit;

      const whereConditions = [];

      if (params.search) {
        whereConditions.push(
          or(like(users.email, `%${params.search}%`), like(users.name, `%${params.search}%`))
        );
      }

      if (params.role) {
        whereConditions.push(like(users.role, `%${params.role}%`));
      }

      const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

      const [userList, totalCount] = await Promise.all([
        db
          .select()
          .from(users)
          .where(whereClause)
          .limit(limit)
          .offset(offset)
          .orderBy(users.createdAt),
        db.select({ count: count() }).from(users).where(whereClause),
      ]);

      const total = totalCount[0]?.count || 0;
      const totalPages = Math.ceil(total / limit);

      if (params.organizationId && params.role !== "admin") {
        const orgMemberEmails = await db
          .select({ email: users.email })
          .from(members)
          .innerJoin(users, eq(members.userId, users.id))
          .where(eq(members.organizationId, params.organizationId));

        const memberEmails = new Set(orgMemberEmails.map((m) => m.email));
        const filteredUsers = userList.filter((user) => memberEmails.has(user.email));

        return {
          users: filteredUsers as User[],
          total: filteredUsers.length,
          page,
          totalPages: Math.ceil(filteredUsers.length / limit),
        };
      }

      return {
        users: userList as User[],
        total,
        page,
        totalPages,
      };
    } catch (error) {
      logger.error("Failed to list users", error as Error);
      throw new AppError(ErrorCode.INTERNAL_SERVER_ERROR, "Failed to list users", 500);
    }
  }

  async resendInvitation(userId: string, adminUserId: string): Promise<void> {
    try {
      const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);

      if (user.length === 0) {
        throw new NotFoundError("User", userId);
      }

      const tempPassword = this.generateTempPassword();

      await auth.api.setUserPassword({
        headers: new Headers(),
        body: {
          userId,
          newPassword: tempPassword,
        },
      });

      logger.info("Invitation resent", {
        userId,
        email: user[0].email,
        resentBy: adminUserId,
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error("Failed to resend invitation", error as Error);
      throw new AppError(ErrorCode.INTERNAL_SERVER_ERROR, "Failed to resend invitation", 500);
    }
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
            createdAt: invitations.createdAt,
          })
          .from(invitations)
          .leftJoin(organizations, eq(invitations.organizationId, organizations.id))
          .leftJoin(users, eq(invitations.inviterId, users.id))
          .where(whereClause)
          .limit(params.limit)
          .offset(offset)
          .orderBy(invitations.expiresAt),
        db
          .select({ count: count() })
          .from(invitations)
          .where(whereClause),
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
        throw new AppError(ErrorCode.INVITATION_ALREADY_USED, "Invitation has already been used", 400);
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
