"use client";

import { UserMenu } from "@/components/layout/user-menu";
import { GlobalSearch, SearchResult } from "@/components/layout/global-search";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { AppUserProps } from "./type";

export function AppTopbar({ user }: AppUserProps) {
  const handleSearchResult = (result: SearchResult) => {
    // Handle navigation based on result type
    console.log("Search result clicked:", result);

    // You can implement navigation logic here
    // For example:
    // if (result.type === 'user') {
    //   router.push(`/users/${result.id}`)
    // } else if (result.type === 'organization') {
    //   router.push(`/organizations/${result.id}`)
    // }
    // etc.
  };

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-[cubic-bezier(0.22,1,0.36,1)] group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 border-b bg-sidebar">
      <div className="flex items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
      </div>
      <GlobalSearch onResultClick={handleSearchResult} />
      <div className="ml-auto px-4">
        <UserMenu user={user} />
      </div>
    </header>
  );
}
