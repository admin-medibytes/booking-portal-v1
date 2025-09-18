import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";

export function useAuth() {
  const { data: authData, isLoading } = useQuery({
    queryKey: ["auth", "session-with-org"],
    queryFn: async () => {
      try {
        // Fetch session data
        const sessionResult = await authClient.getSession();
        if (!sessionResult.data?.user) {
          return { user: null, activeMember: null };
        }

        // Fetch active member/organization in parallel with session
        let activeMember = null;
        try {
          const memberResult = await authClient.organization.getActiveMember();
          activeMember = memberResult.data;

          // If no active member, set the first organization as active
          if (!activeMember) {
            const orgsResult = await authClient.organization.list();
            if (orgsResult.data && orgsResult.data.length > 0) {
              const firstOrg = orgsResult.data[0];
              await authClient.organization.setActive({
                organizationId: firstOrg.id,
              });
              // Fetch the newly set active member
              const newMemberResult = await authClient.organization.getActiveMember();
              activeMember = newMemberResult.data;
            }
          }
        } catch (error) {
          console.error("Error fetching/setting active organization:", error);
        }

        return {
          user: sessionResult.data.user,
          activeMember,
        };
      } catch {
        return { user: null, activeMember: null };
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval: 15 * 60 * 1000, // 15 minutes
  });

  const user = authData?.user
    ? {
        ...authData.user,
        memberRole: authData.activeMember?.role || undefined,
        organizationId: authData.activeMember?.organizationId || undefined,
      }
    : null;

  return {
    user,
    isLoading,
    isAuthenticated: !!authData?.user,
  };
}
