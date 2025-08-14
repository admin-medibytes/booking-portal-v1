import { type InferSelectModel } from "drizzle-orm";
import { users } from "@/server/db/schema";

export type User = InferSelectModel<typeof users>;

export interface CreateUserInput {
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  role: "admin" | "user";
  organizationId?: string;
  teamId?: string;
}

export interface UserListParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  organizationId?: string;
}

export interface UserListResponse {
  users: User[];
  total: number;
  page: number;
  totalPages: number;
}
