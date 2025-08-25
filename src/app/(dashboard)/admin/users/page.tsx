"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Users, UserCheck } from "lucide-react";
import { CreateUserDialog } from "./components/CreateUserDialog";
import { UserListTable } from "./components/UserListTable";
import { UserFilters } from "./components/UserFilters";

export default function UsersPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [filters, setFilters] = useState({
    search: "",
    role: "",
    organizationId: "",
    status: "",
  });

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground mt-2">Create and manage users across organizations</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/admin/users/specialists")}>
            <UserCheck className="mr-2 h-4 w-4" />
            Manage Specialists
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create User
          </Button>
        </div>
      </div>

      <Tabs value="all-users" className="mb-6">
        <TabsList>
          <TabsTrigger value="all-users" onClick={() => router.push("/admin/users")}>
            <Users className="mr-2 h-4 w-4" />
            All Users
          </TabsTrigger>
          <TabsTrigger value="specialists" onClick={() => router.push("/admin/users/specialists")}>
            <UserCheck className="mr-2 h-4 w-4" />
            Specialists
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <UserFilters filters={filters} onFiltersChange={setFilters} />

      <UserListTable filters={filters} />

      <CreateUserDialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} />
    </div>
  );
}
