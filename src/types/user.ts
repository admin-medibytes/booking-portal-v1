import { type InferSelectModel } from "drizzle-orm";
import { users, members, organizations, teams, specialists } from "@/server/db/schema";

export type User = InferSelectModel<typeof users>;
export type Member = InferSelectModel<typeof members>;
export type Organization = InferSelectModel<typeof organizations>;
export type Team = InferSelectModel<typeof teams>;
export type Specialist = InferSelectModel<typeof specialists>;

export interface CreateUserInput {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  jobTitle?: string;
  organizationId: string;
  teamId: string;
  role: "referrer" | "specialist" | "admin";
  sendEmailInvitation: boolean;
  acuityCalendarId?: string;
  createdBy: string;
}

export interface UserMembership {
  organizationId: string;
  organizationName: string;
  teamId?: string;
  teamName?: string;
  role: string;
  joinedAt: string | Date;
}

export interface UserWithMemberships extends User {
  memberships: UserMembership[];
  specialist?: {
    id: string;
    acuityCalendarId: string;
    position: number;
    location?: string | null;
  };
}

export interface UserListParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: "referrer" | "specialist" | "admin" | "manager" | "team_lead";
  organizationId?: string;
  status?: "active" | "inactive";
}

export interface UserListResponse {
  users: UserWithMemberships[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  phone?: string;
  jobTitle?: string;
  isActive?: boolean;
}

export interface UserDetailsResponse extends UserWithMemberships {
  auditHistory?: {
    action: string;
    timestamp: Date;
    performedBy: string;
    metadata?: Record<string, unknown>;
  }[];
}
