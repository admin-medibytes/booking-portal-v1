import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

interface User {
  id: string;
  name: string;
  email: string;
  memberRole?: string;
  role?: string;
}

interface AuthResponse {
  user: User | null;
}

export function useAuth() {
  const { data, isLoading } = useQuery({
    queryKey: ["auth", "session"],
    queryFn: async () => {
      try {
        const response = await apiClient.get<{data: AuthResponse}>("/auth/session");
        return response.data;
      } catch {
        return { user: null };
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  return {
    user: data?.user || null,
    isLoading,
    isAuthenticated: !!data?.user,
  };
}