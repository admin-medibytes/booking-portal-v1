import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { DashboardClientWrapper } from "./dashboard-client-wrapper";
import { db } from "@/server/db";
import { members } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

 if (!session.user.image) {
    redirect("/onboarding");
  }

  // Determine the user's functional role
  let functionalRole: "admin" | "specialist" | "referrer" = "referrer";

  
  if (session.user.role === "admin") {
    functionalRole = "admin";
  } else if (session.session.activeOrganizationId) {
    // Query the members table for the user's organization role
    const memberResult = await db
      .select()
      .from(members)
      .where(
        and(
          eq(members.userId, session.user.id),
          eq(members.organizationId, session.session.activeOrganizationId)
        )
      );
    
    const memberRole = memberResult[0]?.role;
    
    // Map organization roles to functional roles (for now, focus on specialist/referrer)
    if (memberRole === "specialist") {
      functionalRole = "specialist";
    } else if (memberRole === "owner" || memberRole === "manager" || memberRole === "team_lead" || memberRole === "referrer") {
      functionalRole = "referrer";
    }
  }

  const user = {
    name: session.user.name,
    email: session.user.email,
    role: functionalRole,
    image: session.user.image ?? null,
  };

  return <DashboardClientWrapper user={user}>{children}</DashboardClientWrapper>
}
