import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { DashboardClientWrapper } from "./dashboard-client-wrapper";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const user = {
    name: session.user.name,
    email: session.user.email,
    role: session.user.role as "user" | "admin",
    image: session.user.image ?? null,
  };

  return <DashboardClientWrapper user={user}>{children}</DashboardClientWrapper>;
}
