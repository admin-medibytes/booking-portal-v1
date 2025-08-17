import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";

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

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "19rem",
        } as React.CSSProperties
      }
    >
      <AppSidebar user={user} />
      <SidebarInset>
        <AppTopbar user={user} />
        <main className="flex flex-1 flex-col gap-4 p-4 pt-0 bg-stone-100">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
