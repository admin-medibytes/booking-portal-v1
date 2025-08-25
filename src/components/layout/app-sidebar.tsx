"use client";

import * as React from "react";
import { Calendar, FileText, Settings, Users, Shield, Home } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import Brand from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { AppUserProps } from "./type";
import Image from "next/image";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function AppSidebar({ user }: AppUserProps) {
  // Common navigation items for all users
  const commonNavItems: NavItem[] = [
    {
      href: "/bookings",
      label: "Bookings",
      icon: Calendar,
    },
    {
      href: "/documents",
      label: "Documents",
      icon: FileText,
    },
    {
      href: "/settings",
      label: "Settings",
      icon: Settings,
    },
  ];

  // Admin-only navigation items
  const adminNavItems: NavItem[] = [
    {
      href: "/admin",
      label: "Admin Dashboard",
      icon: Home,
    },
    {
      href: "/admin/users",
      label: "User Management",
      icon: Users,
    },
    {
      href: "/admin/audit",
      label: "Audit Logs",
      icon: Shield,
    },
  ];

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <Image src="/logo.png" alt="Medibytes" quality={100} width={32} height={32} />
          <div className="flex flex-col gap-0.5 leading-none">
            <Brand className="uppercase">Medibytes Legal</Brand>
            <span className="text-xs text-muted-foreground">Booking Portal</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {user.role === "admin" && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNavItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild>
                      <a href={item.href}>
                        <item.icon className="size-4" />
                        <span>{item.label}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {commonNavItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild>
                    <a href={item.href}>
                      <item.icon className="size-4" />
                      <span>{item.label}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center justify-between gap-2 px-2 py-1.5">
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{user.name}</span>
                <span className="truncate text-xs">{user.email}</span>
              </div>
              {user.role === "admin" && <Badge className="ml-auto">Admin</Badge>}
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
