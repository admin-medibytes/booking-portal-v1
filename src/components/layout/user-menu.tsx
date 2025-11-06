"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import type { User as UserType } from "@/types/user";

interface UserMenuProps {
  user: Pick<UserType, "name" | "email" | "image">;
}

export function UserMenu({ user }: UserMenuProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);

      // 1. Sign out from Better Auth (clears cookies)
      await authClient.signOut();

      // 2. Clear all React Query caches (fixes auth state persistence bug)
      queryClient.clear();

      // 3. Clear browser storage
      localStorage.clear();
      sessionStorage.clear();

      // 4. Force hard navigation to login (clears all React state)
      window.location.href = "/login";

    } catch (error) {
      console.error("Error logging out:", error);
      // Even on error, force logout to prevent auth state issues
      window.location.href = "/login";
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Get initials for avatar
  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative w-10 h-10 border-2 rounded-full shadow-sm hover:shadow-xl hover:cursor-pointer hover:border hover:border-primary"
        >
          <Avatar className="w-10 h-10">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.name}</p>
            <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {/* <DropdownMenuItem asChild>
          <a href="/settings" className="cursor-pointer">
            <Settings className="w-4 h-4 mr-2" />
            <span>Settings</span>
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator /> */}
        <DropdownMenuItem
          className="text-red-600 cursor-pointer focus:text-red-600"
          onClick={handleLogout}
          disabled={isLoggingOut}
        >
          <LogOut className="w-4 h-4 mr-2 text-red-600 hover:text-red-600" />
          <span>{isLoggingOut ? "Logging out..." : "Log out"}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
