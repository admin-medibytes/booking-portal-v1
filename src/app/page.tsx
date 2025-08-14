import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/server/db";
import { members } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export default async function HomePage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  const user = session.user;

  // Check if user is admin
  if (user.role && user.role.includes("admin")) {
    redirect("/admin");
  }

  // Check user's organization memberships
  const userMemberships = await db
    .select()
    .from(members)
    .where(eq(members.userId, session.user.id));

  if (userMemberships.length > 0) {
    const membership = userMemberships[0];

    switch (membership.role) {
      case "referrer":
        redirect("/bookings");
      case "specialist":
        redirect("/appointments");
      case "owner":
      case "manager":
      case "team_lead":
        redirect("/bookings");
      default:
        break;
    }
  }

  // Default redirect for users without specific roles
  redirect("/profile");
}
