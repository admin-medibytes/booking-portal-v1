import { useQuery } from "@tanstack/react-query";
import { specialistsClient } from "@/lib/hono-client";
import type { Specialist } from "@/types/specialist";

export const queryKeys = {
  all: ["specialists"] as const,
  list: () => [...queryKeys.all, "list"] as const,
  detail: (id: string) => [...queryKeys.all, "detail", id] as const,
};

export function useSpecialists() {
  return useQuery({
    queryKey: queryKeys.list(),
    queryFn: async () => {
      const data = await specialistsClient.list() as { success: boolean; data: Specialist[] };
      return data.data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useSpecialist(id: string) {
  return useQuery({
    queryKey: queryKeys.detail(id),
    queryFn: async () => {
      const data = await specialistsClient.get(id) as { success: boolean; data: Specialist };
      return data.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!id,
  });
}