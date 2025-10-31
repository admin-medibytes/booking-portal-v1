import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }


  const user = session.user;
  
  const authorized = user.email.includes("@medibytes.com.au") || user.email.includes("@senso.ph");

  if (user.role !== "admin" || !authorized) {
    redirect("/");
  }

  return children
}
