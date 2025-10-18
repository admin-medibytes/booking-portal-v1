"use client";

import * as React from "react";
import {
  Calendar,
  Users,
  Home,
  CalendarCheck,
  Plug,
  Building2,
} from "lucide-react";

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
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import Brand from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { AppUserProps } from "./type";
import Image from "next/image";
import Link from "next/link";

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
      label: "Manage Cases",
      icon: Calendar,
    },
    // {
    //   href: "/documents",
    //   label: "Documents",
    //   icon: FileText,
    // },
    // {
    //   href: "/settings",
    //   label: "Settings",
    //   icon: Settings,
    // },
  ];

  // Admin-only navigation items
  const adminNavItems: NavItem[] = [
    {
      href: "/admin/users",
      label: "User Management",
      icon: Users,
    },
    {
      href: "/admin/organizations",
      label: "Organizations",
      icon: Building2,
    },
    // {
    //   href: "/admin/audit",
    //   label: "Audit Logs",
    //   icon: Shield,
    // },
    {
      href: "/admin/integrations",
      label: "Integrations",
      icon: Plug,
    },
  ];

  const { setOpen } = useSidebar();

  React.useEffect(
    () => {
      const getCookie = (name: string) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop()?.split(";").shift();
        return null;
      };

      const sidebarState = getCookie("sidebar_state");
      if (!!sidebarState) {
        setOpen(sidebarState === "false" ? false : true);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

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
          <SidebarGroupLabel>Bookings</SidebarGroupLabel>
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
        {user.role !== "specialist" && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <div className="px-3 pb-3">
                <Card className="rounded-[.5rem] border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/20">
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2">
                        <CalendarCheck className="size-5 text-primary" />
                        <h3 className="font-semibold text-sm">Need Psychiatrist IME?</h3>
                      </div>
                      {/* <p className="text-xs text-muted-foreground leading-relaxed">
                        Book an appointment with our specialists for expert medical legal
                        consultations.
                      </p> */}
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button asChild size="sm" className="w-full mt-auto rounded">
                      <Link href="/bookings/new">Book Now</Link>
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            </SidebarGroup>
          </>
        )}
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
