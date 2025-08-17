import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
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
      const response = await apiClient.get<{ success: boolean; data: Specialist[] }>("/api/specialists");
      return response.data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useSpecialist(id: string) {
  return useQuery({
    queryKey: queryKeys.detail(id),
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: Specialist }>(`/api/specialists/${id}`);
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!id,
  });
}