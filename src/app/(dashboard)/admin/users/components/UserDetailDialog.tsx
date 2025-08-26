"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { adminClient } from "@/lib/hono-client";
import { formatLocationShort } from "@/lib/utils/location";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Edit2, X, Check } from "lucide-react";
import { format } from "date-fns";

interface UserDetailDialogProps {
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserDetailDialog({ userId, open, onOpenChange }: UserDetailDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    jobTitle: "",
  });

  const {
    data: userData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["user", userId],
    queryFn: async () => {
      const response = await adminClient.users[":id"].$get({
        param: { id: userId },
      });
      if (!response.ok) throw new Error("Failed to fetch user details");
      const data = await response.json();
      setEditForm({
        firstName: data.user.firstName || "",
        lastName: data.user.lastName || "",
        phone: data.user.phoneNumber || "",
        jobTitle: data.user.jobTitle || "",
      });
      return data;
    },
    enabled: open && !!userId,
  });

  const updateUserMutation = useMutation({
    mutationFn: async (values: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      jobTitle?: string;
    }) => {
      const response = await adminClient.users[":id"].$put({
        param: { id: userId },
        json: values,
      });
      if (!response.ok) throw new Error("Failed to update user");
      return response.json();
    },
    onSuccess: () => {
      toast.success("User updated successfully");
      setIsEditing(false);
      refetch();
    },
    onError: () => {
      toast.error("Failed to update user");
    },
  });

  const handleSaveEdit = () => {
    updateUserMutation.mutate(editForm);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    if (userData?.user) {
      setEditForm({
        firstName: userData.user.firstName || "",
        lastName: userData.user.lastName || "",
        phone: userData.user.phoneNumber || "",
        jobTitle: userData.user.jobTitle || "",
      });
    }
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogTitle />
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const user = userData?.user;

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>User Details</DialogTitle>
          <DialogDescription>
            View and manage user information, memberships, and audit history.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="info" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="info">Information</TabsTrigger>
            <TabsTrigger value="memberships">Memberships</TabsTrigger>
            <TabsTrigger value="audit">Audit History</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Personal Information</CardTitle>
                {!isEditing ? (
                  <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancelEdit}
                      disabled={updateUserMutation.isPending}
                    >
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveEdit}
                      disabled={updateUserMutation.isPending}
                    >
                      {updateUserMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4 mr-2" />
                      )}
                      Save
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>First Name</Label>
                    {isEditing ? (
                      <Input
                        value={editForm.firstName}
                        onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                      />
                    ) : (
                      <p className="text-sm">{user.firstName}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Last Name</Label>
                    {isEditing ? (
                      <Input
                        value={editForm.lastName}
                        onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                      />
                    ) : (
                      <p className="text-sm">{user.lastName}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Email</Label>
                  <p className="text-sm">{user.email}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    {isEditing ? (
                      <Input
                        value={editForm.phone}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        placeholder="Enter phone number"
                      />
                    ) : (
                      <p className="text-sm">{user.phoneNumber || "Not provided"}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Job Title</Label>
                    {isEditing ? (
                      <Input
                        value={editForm.jobTitle}
                        onChange={(e) => setEditForm({ ...editForm, jobTitle: e.target.value })}
                        placeholder="Enter job title"
                      />
                    ) : (
                      <p className="text-sm">{user.jobTitle || "N/A"}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <div>
                      {user.banned ? (
                        <Badge variant="destructive">Inactive</Badge>
                      ) : (
                        <Badge variant="success">Active</Badge>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Email Verified</Label>
                    <div>
                      {user.emailVerified ? (
                        <Badge variant="success">Verified</Badge>
                      ) : (
                        <Badge variant="secondary">Unverified</Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Created At</Label>
                  <p className="text-sm">{format(new Date(user.createdAt), "PPpp")}</p>
                </div>
              </CardContent>
            </Card>

            {user.specialist && (
              <Card>
                <CardHeader>
                  <CardTitle>Specialist Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Acuity Calendar ID</Label>
                      <p className="font-mono text-sm">{user.specialist.acuityCalendarId}</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Position</Label>
                      <p className="text-sm">#{user.specialist.position}</p>
                    </div>
                  </div>
                  {user.specialist.location && (
                    <div className="space-y-2">
                      <Label>Location</Label>
                      <p className="text-sm">{formatLocationShort(user.specialist.location) || "Not specified"}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="memberships">
            <Card>
              <CardHeader>
                <CardTitle>Organization Memberships</CardTitle>
                <CardDescription>All organizations and roles assigned to this user</CardDescription>
              </CardHeader>
              <CardContent>
                {user.memberships?.length > 0 ? (
                  <div className="space-y-4">
                    {user.memberships.map((membership) => (
                      <div
                        key={membership.organizationId}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{membership.organizationName}</p>
                          <p className="text-sm text-muted-foreground">
                            Joined{" "}
                            {format(
                              typeof membership.joinedAt === "string"
                                ? new Date(membership.joinedAt)
                                : membership.joinedAt,
                              "PP"
                            )}
                          </p>
                        </div>
                        <Badge>{membership.role}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No organization memberships found</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit">
            <Card>
              <CardHeader>
                <CardTitle>Audit History</CardTitle>
                <CardDescription>Recent actions and changes related to this user</CardDescription>
              </CardHeader>
              <CardContent>
                {user.auditHistory && user.auditHistory.length > 0 ? (
                  <div className="space-y-2">
                    {user.auditHistory.map((log, index: number) => (
                      <div
                        key={index}
                        className="flex items-start justify-between py-2 border-b last:border-0"
                      >
                        <div className="space-y-1">
                          <p className="text-sm font-medium">{log.action}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(
                              typeof log.timestamp === "string"
                                ? new Date(log.timestamp)
                                : log.timestamp,
                              "PPpp"
                            )}
                          </p>
                        </div>
                        {log.metadata && (
                          <Badge variant="outline" className="text-xs">
                            {JSON.stringify(log.metadata)}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No audit history available</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
