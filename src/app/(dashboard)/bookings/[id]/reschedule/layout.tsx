import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { members } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

export default async function RescheduleBookingLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  // Check if user is a specialist
  if (session.user.role !== "admin" && session.session.activeOrganizationId) {
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

    // Specialists cannot reschedule bookings
    if (memberRole === "specialist") {
      redirect("/bookings");
    }
  }

  return <>{children}</>;
}
