import type { User } from "@/types/user";

export interface AppUserProps {
  user: Pick<User, "name" | "email" | "role" | "image">;
}
