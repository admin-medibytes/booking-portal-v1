import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export default async function HomePage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  console.log("IMAGEE", session.user.image);

  if (session.user.image !== "initialized") {
    redirect("/onboarding");
  }

  // Admin users go to admin dashboard
  if (session.user.role === "admin") {
    redirect("/admin");
  }

  // All other authenticated users go to bookings
  redirect("/bookings");
}
