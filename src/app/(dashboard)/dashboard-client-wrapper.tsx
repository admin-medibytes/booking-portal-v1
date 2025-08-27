"use client";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";

interface DashboardClientWrapperProps {
  children: React.ReactNode;
  user: {
    name: string;
    email: string;
    role: "admin" | "specialist" | "referrer";
    image: string | null;
  };
}

export function DashboardClientWrapper({ children, user }: DashboardClientWrapperProps) {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "19rem",
        } as React.CSSProperties
      }
    >
      <AppSidebar user={user} />
      <SidebarInset className="flex flex-col h-screen overflow-hidden">
        <AppTopbar user={user} />
        <main className="flex flex-1 flex-col gap-4 p-4 pt-0 bg-white overflow-y-auto">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
