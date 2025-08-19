"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { MoreHorizontal, Eye, Edit, Trash, Users, Building2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { adminClient } from "@/lib/hono-client";
import { toast } from "sonner";

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

interface OrganizationListTableProps {
  data?: {
    organizations: Organization[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  isLoading: boolean;
  page: number;
  onPageChange: (page: number) => void;
  onRefresh: () => void;
}

export function OrganizationListTable({
  data,
  isLoading,
  page,
  onPageChange,
  onRefresh,
}: OrganizationListTableProps) {
  const router = useRouter();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (orgId: string) => {
      const response = await adminClient.organizations[":id"].$delete({
        param: { id: orgId },
      });

      if (!response.ok) {
        const error = (await response.json()) as { message?: string };
        throw new Error(error.message || "Failed to delete organization");
      }
    },
    onSuccess: () => {
      toast.success("Organization deleted successfully");
      setDeleteDialogOpen(false);
      setSelectedOrg(null);
      onRefresh();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete organization");
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="border rounded-md bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Teams</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="w-32 h-4" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="w-20 h-4" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="w-40 h-4" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="w-12 h-4" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="w-12 h-4" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="w-16 h-4" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="w-8 h-8" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  if (!data || data.organizations.length === 0) {
    return (
      <div className="p-8 border rounded-md">
        <div className="flex flex-col items-center justify-center text-center">
          <Building2 className="w-12 h-12 mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold">No organizations found</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Get started by creating your first organization.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-md bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Organization</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Teams</TableHead>
              <TableHead>Members</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.organizations.map((org) => (
              <TableRow key={org.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">{org.name}</div>
                    <div className="text-sm text-muted-foreground">{org.slug}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {org.contactEmail && <div>{org.contactEmail}</div>}
                    {org.phone && <div className="text-muted-foreground">{org.phone}</div>}
                    {!org.contactEmail && !org.phone && (
                      <span className="text-muted-foreground">No contact info</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span>{org.teamCount}</span>
                  </div>
                </TableCell>
                <TableCell>{org.memberCount}</TableCell>
                <TableCell>
                  <Badge variant={org.metadata?.isActive === false ? "secondary" : "default"}>
                    {org.metadata?.isActive === false ? "Inactive" : "Active"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="w-8 h-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem
                        onClick={() => router.push(`/admin/organizations/${org.id}`)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => router.push(`/admin/organizations/${org.id}?edit=true`)}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => {
                          setSelectedOrg(org);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-2 py-4">
          <div className="text-sm text-muted-foreground">
            Showing {(page - 1) * data.pagination.limit + 1} to{" "}
            {Math.min(page * data.pagination.limit, data.pagination.total)} of{" "}
            {data.pagination.total} organizations
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page === data.pagination.totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the organization &quot;{selectedOrg?.name}&quot; and all
              associated data including teams and memberships. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedOrg && deleteMutation.mutate(selectedOrg.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Organization
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
