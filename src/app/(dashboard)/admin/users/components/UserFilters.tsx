"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
// Organizations will be fetched from parent or passed as props

interface UserFiltersProps {
  filters: {
    search: string;
    role: string;
    organizationId: string;
    status: string;
  };
  onFiltersChange: (filters: {
    search: string;
    role: string;
    organizationId: string;
    status: string;
  }) => void;
}

export function UserFilters({ filters, onFiltersChange }: UserFiltersProps) {
  const { data: orgsData } = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      // For now, return mock data - should be replaced with actual endpoint
      return {
        organizations: [
          { id: "org-1", name: "MediLaw Firm" },
          { id: "org-2", name: "WorkComp Associates" },
        ],
      };
    },
  });

  const handleClearFilters = () => {
    onFiltersChange({
      search: "",
      role: "",
      organizationId: "",
      status: "",
    });
  };

  const hasActiveFilters = Object.values(filters).some((value) => value !== "");

  return (
    <div className="mb-6 space-y-4">
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[300px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search by name or email..."
              value={filters.search}
              onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
              className="pl-10 bg-background"
            />
          </div>
        </div>

        <Select
          value={filters.role || "all"}
          onValueChange={(value) =>
            onFiltersChange({ ...filters, role: value === "all" ? "" : value })
          }
        >
          <SelectTrigger className="w-[180px] bg-background hover:bg-accent">
            <SelectValue placeholder="All Roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="referrer">Referrer</SelectItem>
            <SelectItem value="specialist">Specialist</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="manager">Manager</SelectItem>
            <SelectItem value="team_lead">Team Lead</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.organizationId || "all"}
          onValueChange={(value) =>
            onFiltersChange({ ...filters, organizationId: value === "all" ? "" : value })
          }
        >
          <SelectTrigger className="w-[200px] bg-background hover:bg-accent">
            <SelectValue placeholder="All Organizations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Organizations</SelectItem>
            {orgsData?.organizations?.map((org: { id: string; name: string }) => (
              <SelectItem key={org.id} value={org.id}>
                {org.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.status || "all"}
          onValueChange={(value) =>
            onFiltersChange({ ...filters, status: value === "all" ? "" : value })
          }
        >
          <SelectTrigger className="w-[150px] bg-background hover:bg-accent">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={handleClearFilters} className="h-10">
            <X className="mr-2 h-4 w-4" />
            Clear Filters
          </Button>
        )}
      </div>
    </div>
  );
}
