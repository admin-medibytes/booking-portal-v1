"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateOrganizationDialog } from "./components/CreateOrganizationDialog";
import { OrganizationListTable } from "./components/OrganizationListTable";
import { OrganizationFilters } from "./components/OrganizationFilters";
import { adminClient } from "@/lib/hono-client";

interface OrganizationFilters {
  search?: string;
  status?: "active" | "inactive";
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  contactEmail?: string;
  phone?: string;
  memberCount: number;
  teamCount: number;
  metadata?: {
    isActive?: boolean;
  };
}

interface OrganizationListResponse {
  organizations: Organization[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function OrganizationsPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [filters, setFilters] = useState<OrganizationFilters>({});
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading, refetch } = useQuery<OrganizationListResponse>({
    queryKey: ["organizations", filters, page],
    queryFn: async () => {
      const response = await adminClient.organizations.$get({
        query: {
          page: page.toString(),
          limit: limit.toString(),
          ...(filters.search && { search: filters.search }),
          ...(filters.status && { status: filters.status }),
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch organizations");
      }

      const d = (await response.json()) as OrganizationListResponse;

      return d;
    },
  });

  const handleCreateSuccess = () => {
    setIsCreateDialogOpen(false);
    refetch();
  };

  return (
    <div className="container py-8 mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Organizations</h1>
          <p className="mt-1 text-muted-foreground">Manage organizations and their teams</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Organization
        </Button>
      </div>

      <OrganizationFilters filters={filters} onFiltersChange={setFilters} />

      <OrganizationListTable
        data={data}
        isLoading={isLoading}
        page={page}
        onPageChange={setPage}
        onRefresh={refetch}
      />

      <CreateOrganizationDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
}
