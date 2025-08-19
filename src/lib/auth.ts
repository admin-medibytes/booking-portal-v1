import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins/admin";
import { organization } from "better-auth/plugins/organization";
import { twoFactor } from "better-auth/plugins/two-factor";
import { phoneNumber } from "better-auth/plugins/phone-number";
import { emailOTP } from "better-auth/plugins/email-otp";
import { db } from "@/server/db";
import { env } from "@/lib/env";
import { emailService } from "@/server/services/email.service";
import { hashPassword, verifyPassword } from "@/lib/crypto";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true,
  }),

  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,

  trustedOrigins: env.AUTH_TRUSTED_ORIGINS?.split(",").map((origin) => origin.trim()) || [],

  session: {
    expiresIn: Number(env.SESSION_TIMEOUT) || 604800, // 7 days
    updateAge: 86400, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 180, // 3 minutes
    },
  },

  advanced: {
    useSecureCookies: env.NODE_ENV === "production",
    cookiePrefix: env.NODE_ENV === "production" ? "__Secure-" : "",
  },

  user: {
    additionalFields: {
      firstName: { type: "string", required: true },
      lastName: { type: "string", required: true },
      jobTitle: { type: "string", required: true },
    },
  },

  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    disableSignUp: true,
    requireEmailVerification: true,
    password: {
      hash: async (password) => await hashPassword(password),
      verify: async ({ password, hash }) => await verifyPassword(password, hash),
    },
    sendResetPassword: async ({ user, url }) => {
      await emailService.sendPasswordResetEmail({
        email: user.email,
        resetLink: url,
      });
    },
    resetPasswordPageUrl: "/reset-password",
  },

  emailVerification: {
    autoSignInAfterVerification: true,
    sendVerificationEmail: async () => {},
  },

  rateLimit: {
    enabled: true,
    window: Number(env.RATE_LIMIT_WINDOW_MS) || 60000, // 1 minute
    max: Number(env.RATE_LIMIT_MAX_REQUESTS) || 10,
  },

  plugins: [
    admin({
      defaultRole: "user",
      adminRole: "admin",
    }),

    organization({
      allowUserToCreateOrganization: async (user) => {
        return user.role === "admin";
      },
      teams: {
        enabled: true,
        defaultTeam: {
          enabled: true,
          customCreateDefaultTeam: async (organization) => {
            return {
              id: crypto.randomUUID(),
              name: "Default Team",
              organizationId: organization.id,
              createdAt: new Date(),
            };
          },
        },
        allowRemovingAllTeams: false,
      },
      creatorRole: "owner",
      invitationExpiresIn: 604800, // 7 days
      sendInvitationEmail: async ({ email, inviter, organization, id, invitation }) => {
        const inviteLink = `${env.APP_URL}/accept-invitation/${id}`;
        await emailService.sendInvitationEmail({
          email,
          inviteLink,
          inviterName: inviter.user.name || inviter.user.email,
          inviterEmail: inviter.user.email,
          organizationName: organization.name,
          expiresAt: invitation.expiresAt,
        });
      },
      schema: {
        organization: {
          additionalFields: {
            contactEmail: {
              type: "string",
              required: false,
              input: true,
            },
            phone: {
              type: "string",
              required: false,
              input: true,
            },
            address: {
              type: "string",
              required: false,
              input: true,
            },
          },
        },
      },
      organizationCreation: {
        beforeCreate: async ({ organization, user }) => {
          return {
            data: {
              ...organization,
              metadata: {
                ...organization.metadata,
                createdBy: user.id,
              },
            },
          };
        },
        afterCreate: async ({ organization, user }) => {
          const { auditService } = await import("@/server/services/audit.service");
          await auditService.log({
            userId: user.id,
            action: "organization.created",
            resourceType: "organization",
            resourceId: organization.id,
            metadata: {
              organizationName: organization.name,
              organizationSlug: organization.slug,
            },
          });
        },
      },
      organizationDeletion: {
        beforeDelete: async () => {
          return;
        },
        afterDelete: async ({ organization, user }) => {
          const { auditService } = await import("@/server/services/audit.service");
          await auditService.log({
            userId: user.id,
            action: "organization.deleted",
            resourceType: "organization",
            resourceId: organization.id,
            metadata: {
              organizationName: organization.name,
              organizationSlug: organization.slug,
            },
          });
        },
      },
    }),

    twoFactor({
      issuer: env.APP_NAME || "Medibytes Booking Portal",
      totpOptions: {
        period: 30,
        digits: 6,
      },
      backupCodeOptions: {
        amount: 10,
        length: 8,
      },
    }),

    phoneNumber({
      sendOTP: async ({ phoneNumber, code }) => {
        await emailService.sendPhoneOTP({ phoneNumber, code });
      },
      otpLength: 6,
      expiresIn: 300, // 5 minutes
      signUpOnVerification: {
        getTempEmail: (phoneNumber) => {
          // Generate a temporary email from phone number
          const cleanPhone = phoneNumber.replace(/[^0-9]/g, "");
          return `${cleanPhone}@temp.${env.APP_URL?.replace(/https?:\/\//, "") || "medibytes.com"}`;
        },
        getTempName: (phoneNumber) => {
          return phoneNumber; // Use phone number as temporary name
        },
      },
      requireVerification: env.FEATURE_PHONE_VERIFICATION === "true",
    }),

    emailOTP({
      sendVerificationOTP: async ({ email, otp, type }) => {
        await emailService.sendOTPEmail({ email, otp, type });
      },
      otpLength: 6,
      expiresIn: 300, // 5 minutes
      allowedAttempts: 3,
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;
// export type User = typeof auth.$Infer.User;
export type Organization = typeof auth.$Infer.Organization;
