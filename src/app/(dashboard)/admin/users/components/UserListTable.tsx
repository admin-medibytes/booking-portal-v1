"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminClient } from "@/lib/hono-client";
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
import { ChevronDown, ChevronRight, Mail, MoreHorizontal, UserCheck, UserX } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserDetailDialog } from "./UserDetailDialog";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import type { UserMembership } from "@/types/user";

interface UserListTableProps {
  filters: {
    search: string;
    role: string;
    organizationId: string;
    status: string;
  };
}

export function UserListTable({ filters }: UserListTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["users", filters, page],
    queryFn: async () => {
      const response = await adminClient.users.$get({
        query: {
          page: page.toString(),
          limit: "20",
          ...(filters.search && { search: filters.search }),
          ...(filters.role && {
            role: filters.role as "referrer" | "specialist" | "admin" | "manager" | "team_lead",
          }),
          ...(filters.organizationId && { organizationId: filters.organizationId }),
          ...(filters.status && { status: filters.status as "active" | "inactive" }),
        },
      });
      if (!response.ok) throw new Error("Failed to fetch users");
      return response.json();
    },
  });

  const toggleRow = (userId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
    }
    setExpandedRows(newExpanded);
  };

  const handleStatusChange = async (userId: string, isActive: boolean) => {
    try {
      const response = await adminClient.users[":id"].status.$put({
        param: { id: userId },
        json: { isActive },
      });
      if (!response.ok) throw new Error("Failed to update user status");
      toast.success(`User ${isActive ? "activated" : "deactivated"} successfully`);
      refetch();
    } catch {
      toast.error("Failed to update user status");
    }
  };

  const handleResendInvite = async (userId: string) => {
    try {
      const response = await adminClient.users[":id"].invite.$post({
        param: { id: userId },
      });
      if (!response.ok) throw new Error("Failed to send invitation");
      toast.success("Invitation sent successfully");
    } catch {
      toast.error("Failed to send invitation");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="w-full h-16" />
        ))}
      </div>
    );
  }

  const users = data?.users || [];
  const pagination = data?.pagination || { page: 1, totalPages: 1 };

  return (
    <div className="space-y-4 bg-background">
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30px]"></TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Primary Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <>
                <TableRow key={user.id}>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleRow(user.id)}
                      className="w-6 h-6 p-0"
                    >
                      {expandedRows.has(user.id) ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </Button>
                  </TableCell>
                  <TableCell className="font-medium">
                    {user.firstName} {user.lastName}
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.phoneNumber || "-"}</TableCell>
                  <TableCell>
                    {user.memberships?.[0]?.role ? (
                      <Badge variant="outline">{user.memberships[0].role}</Badge>
                    ) : (
                      <Badge variant="secondary">No Role</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {user.banned ? (
                      <Badge variant="destructive">Inactive</Badge>
                    ) : (
                      <Badge variant="success">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setSelectedUserId(user.id)}>
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleResendInvite(user.id)}>
                          <Mail className="w-4 h-4 mr-2" />
                          Send Invitation
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {user.banned ? (
                          <DropdownMenuItem onClick={() => handleStatusChange(user.id, true)}>
                            <UserCheck className="w-4 h-4 mr-2" />
                            Activate User
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() => handleStatusChange(user.id, false)}
                            className="text-destructive"
                          >
                            <UserX className="w-4 h-4 mr-2" />
                            Deactivate User
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
                {expandedRows.has(user.id) && user.memberships && user.memberships.length > 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="bg-muted/50">
                      <div className="p-4">
                        <h4 className="mb-2 text-sm font-semibold">Organization Memberships</h4>
                        <div className="space-y-2">
                          {user.memberships.map((membership: UserMembership) => (
                            <div
                              key={`${user.id}-${membership.organizationId}`}
                              className="flex items-center space-x-4 text-sm"
                            >
                              <span className="font-medium">{membership.organizationName}</span>
                              <Badge variant="outline">{membership.role}</Badge>
                              {membership.teamName && (
                                <span className="text-muted-foreground">
                                  Team: {membership.teamName}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                        {user.specialist && (
                          <div className="pt-4 mt-4 border-t">
                            <h4 className="mb-2 text-sm font-semibold">Specialist Details</h4>
                            <div className="space-y-1 text-sm">
                              <p>
                                <span className="text-muted-foreground">Acuity Calendar ID:</span>{" "}
                                {user.specialist.acuityCalendarId}
                              </p>
                              <p>
                                <span className="text-muted-foreground">Specialty:</span>{" "}
                                {user.specialist.specialty}
                              </p>
                              {user.specialist.location && (
                                <p>
                                  <span className="text-muted-foreground">Location:</span>{" "}
                                  {user.specialist.location}
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))}
          </TableBody>
        </Table>
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={page === pagination.totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {selectedUserId && (
        <UserDetailDialog
          userId={selectedUserId}
          open={!!selectedUserId}
          onOpenChange={(open) => !open && setSelectedUserId(null)}
        />
      )}
    </div>
  );
}
