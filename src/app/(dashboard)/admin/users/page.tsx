"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus, Users, Stethoscope } from "lucide-react";
import { CreateUserDialog } from "./components/CreateUserDialog";
import { UserListTable } from "./components/UserListTable";
import { UserFilters } from "./components/UserFilters";

export default function UsersPage() {
  const router = useRouter();

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
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create User
        </Button>
      </div>

      {/* Navigation Tabs - Button Group Style */}
      <div className="mb-6">
        <div className="flex gap-1 p-1 rounded-xl bg-muted w-fit border">
          <Button variant="default" size="sm" onClick={() => router.push("/admin/users")}>
            <Users className="mr-2 h-4 w-4" />
            All Users
          </Button>
          <Button variant="ghost" size="sm" onClick={() => router.push("/admin/users/specialists")}>
            <Stethoscope className="mr-2 h-4 w-4" />
            Specialists
          </Button>
        </div>
      </div>

      <UserFilters filters={filters} onFiltersChange={setFilters} />

      <UserListTable filters={filters} />

      <CreateUserDialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} />
    </div>
  );
}
