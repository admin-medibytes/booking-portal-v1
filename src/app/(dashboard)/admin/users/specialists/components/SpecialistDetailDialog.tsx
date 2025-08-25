"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminClient, specialistsClient } from "@/lib/hono-client";
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Edit2, X, Check, User, Mail, Phone, MapPin, Calendar, Hash, Building } from "lucide-react";
import { format } from "date-fns";

interface Specialist {
  id: string;
  userId: string;
  acuityCalendarId: string;
  name: string;
  location: string | null;
  position: number;
  isActive: boolean;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    jobTitle: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface ExtendedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  phoneNumber?: string | null;
  emailVerified?: boolean;
  banned?: boolean;
  createdAt: string;
  memberships?: Array<{
    organizationId: string;
    organizationName: string;
    role: string;
    joinedAt: string | Date;
  }>;
}

interface SpecialistDetailDialogProps {
  specialist: Specialist;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SpecialistDetailDialog({ specialist, open, onOpenChange }: SpecialistDetailDialogProps) {
  const queryClient = useQueryClient();
  const [isEditingSpecialist, setIsEditingSpecialist] = useState(false);
  const [isEditingUser, setIsEditingUser] = useState(false);
  
  const [specialistForm, setSpecialistForm] = useState({
    name: specialist.name,
    location: specialist.location || "",
    isActive: specialist.isActive,
  });
  
  const [userForm, setUserForm] = useState({
    firstName: specialist.user.firstName,
    lastName: specialist.user.lastName,
    phone: "",
    jobTitle: specialist.user.jobTitle,
  });

  // Fetch detailed user data
  const { data: userData, refetch: refetchUser } = useQuery({
    queryKey: ["user", specialist.userId],
    queryFn: async () => {
      const response = await adminClient.users[":id"].$get({
        param: { id: specialist.userId },
      });
      if (!response.ok) throw new Error("Failed to fetch user details");
      const data = await response.json();
      // Update user form with fetched data
      if (data.user) {
        setUserForm({
          firstName: data.user.firstName || "",
          lastName: data.user.lastName || "",
          phone: data.user.phoneNumber || "",
          jobTitle: data.user.jobTitle || "",
        });
      }
      return data;
    },
    enabled: open && !!specialist.userId,
  });

  // Update specialist mutation
  const updateSpecialistMutation = useMutation({
    mutationFn: async (values: {
      name?: string;
      location?: string;
      isActive?: boolean;
    }) => {
      const response = await specialistsClient[":id"].$put({
        param: { id: specialist.id },
        json: values,
      });
      if (!response.ok) throw new Error("Failed to update specialist");
      return response.json();
    },
    onSuccess: () => {
      toast.success("Specialist updated successfully");
      setIsEditingSpecialist(false);
      queryClient.invalidateQueries({ queryKey: ["admin-specialists"] });
    },
    onError: () => {
      toast.error("Failed to update specialist");
    },
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async (values: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      jobTitle?: string;
    }) => {
      const response = await adminClient.users[":id"].$put({
        param: { id: specialist.userId },
        json: values,
      });
      if (!response.ok) throw new Error("Failed to update user");
      return response.json();
    },
    onSuccess: () => {
      toast.success("User information updated successfully");
      setIsEditingUser(false);
      refetchUser();
      queryClient.invalidateQueries({ queryKey: ["admin-specialists"] });
    },
    onError: () => {
      toast.error("Failed to update user information");
    },
  });

  const handleSaveSpecialist = () => {
    updateSpecialistMutation.mutate(specialistForm);
  };

  const handleCancelSpecialistEdit = () => {
    setIsEditingSpecialist(false);
    setSpecialistForm({
      name: specialist.name,
      location: specialist.location || "",
      isActive: specialist.isActive,
    });
  };

  const handleSaveUser = () => {
    updateUserMutation.mutate(userForm);
  };

  const handleCancelUserEdit = () => {
    setIsEditingUser(false);
    const userToRevert = userData?.user || specialist.user;
    setUserForm({
      firstName: userToRevert.firstName || "",
      lastName: userToRevert.lastName || "",
      phone: (userData?.user as ExtendedUser)?.phoneNumber || "",
      jobTitle: userToRevert.jobTitle || "",
    });
  };

  const user: ExtendedUser = userData?.user || {
    ...specialist.user,
    phoneNumber: "",
    emailVerified: false,
    banned: false,
    createdAt: specialist.createdAt,
    memberships: []
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Specialist Details
          </DialogTitle>
          <DialogDescription>
            View and manage specialist information, user details, and organizational assignments.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 mt-4">
          <Badge variant={specialist.isActive ? "success" : "secondary"} className="text-sm">
            {specialist.isActive ? "Active" : "Inactive"}
          </Badge>
          <Badge variant="outline" className="text-sm font-mono">
            Position #{specialist.position}
          </Badge>
          {user.emailVerified && (
            <Badge variant="outline" className="text-sm">
              Email Verified
            </Badge>
          )}
        </div>

        <Tabs defaultValue="specialist" className="mt-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="specialist">Specialist Info</TabsTrigger>
            <TabsTrigger value="user">User Details</TabsTrigger>
            <TabsTrigger value="organizations">Organizations</TabsTrigger>
          </TabsList>

          <TabsContent value="specialist" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Specialist Information</CardTitle>
                {!isEditingSpecialist ? (
                  <Button variant="outline" size="sm" onClick={() => setIsEditingSpecialist(true)}>
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancelSpecialistEdit}
                      disabled={updateSpecialistMutation.isPending}
                    >
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveSpecialist}
                      disabled={updateSpecialistMutation.isPending}
                    >
                      {updateSpecialistMutation.isPending ? (
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
                <div className="space-y-2">
                  <Label>Display Name</Label>
                  {isEditingSpecialist ? (
                    <Input
                      value={specialistForm.name}
                      onChange={(e) => setSpecialistForm({ ...specialistForm, name: e.target.value })}
                      placeholder="Enter display name"
                    />
                  ) : (
                    <p className="text-sm font-medium">{specialist.name}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Location</Label>
                  {isEditingSpecialist ? (
                    <Input
                      value={specialistForm.location}
                      onChange={(e) => setSpecialistForm({ ...specialistForm, location: e.target.value })}
                      placeholder="Enter location"
                    />
                  ) : (
                    <p className="text-sm">{specialist.location || "Not specified"}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Acuity Calendar ID</Label>
                    <p className="font-mono text-sm bg-muted px-2 py-1 rounded">
                      {specialist.acuityCalendarId}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Display Position</Label>
                    <p className="text-sm font-medium">#{specialist.position}</p>
                  </div>
                </div>

                {isEditingSpecialist && (
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="active-status"
                      checked={specialistForm.isActive}
                      onCheckedChange={(checked: boolean) => 
                        setSpecialistForm({ ...specialistForm, isActive: checked })
                      }
                    />
                    <Label htmlFor="active-status">Active</Label>
                  </div>
                )}

                <div className="pt-4 border-t space-y-2">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>Created: {format(new Date(specialist.createdAt), "PP")}</span>
                    <span>•</span>
                    <span>Updated: {format(new Date(specialist.updatedAt), "PP")}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="user" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>User Information</CardTitle>
                {!isEditingUser ? (
                  <Button variant="outline" size="sm" onClick={() => setIsEditingUser(true)}>
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancelUserEdit}
                      disabled={updateUserMutation.isPending}
                    >
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveUser}
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
                    {isEditingUser ? (
                      <Input
                        value={userForm.firstName}
                        onChange={(e) => setUserForm({ ...userForm, firstName: e.target.value })}
                      />
                    ) : (
                      <p className="text-sm">{user.firstName}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Last Name</Label>
                    {isEditingUser ? (
                      <Input
                        value={userForm.lastName}
                        onChange={(e) => setUserForm({ ...userForm, lastName: e.target.value })}
                      />
                    ) : (
                      <p className="text-sm">{user.lastName}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <p className="text-sm">{user.email}</p>
                    {user.emailVerified && (
                      <Badge variant="outline" className="text-xs">Verified</Badge>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Phone Number</Label>
                    {isEditingUser ? (
                      <Input
                        value={userForm.phone}
                        onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                        placeholder="Enter phone number"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <p className="text-sm">{user.phoneNumber || "Not provided"}</p>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Job Title</Label>
                    {isEditingUser ? (
                      <Input
                        value={userForm.jobTitle}
                        onChange={(e) => setUserForm({ ...userForm, jobTitle: e.target.value })}
                        placeholder="Enter job title"
                      />
                    ) : (
                      <p className="text-sm">{user.jobTitle || "Not specified"}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Account Status</Label>
                    <div>
                      {user.banned ? (
                        <Badge variant="destructive">Banned</Badge>
                      ) : (
                        <Badge variant="success">Active</Badge>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>User ID</Label>
                    <p className="font-mono text-xs bg-muted px-2 py-1 rounded truncate">
                      {user.id}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <Label>Account Created</Label>
                  <p className="text-sm mt-1">{format(new Date(user.createdAt), "PPpp")}</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="organizations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Organization Memberships</CardTitle>
                <CardDescription>All organizations and roles assigned to this specialist</CardDescription>
              </CardHeader>
              <CardContent>
                {user.memberships && user.memberships.length > 0 ? (
                  <div className="space-y-3">
                    {user.memberships.map((membership) => (
                      <div
                        key={membership.organizationId}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-start gap-3">
                          <Building className="w-5 h-5 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="font-medium">{membership.organizationName}</p>
                            <p className="text-sm text-muted-foreground">
                              Joined {format(
                                typeof membership.joinedAt === "string"
                                  ? new Date(membership.joinedAt)
                                  : membership.joinedAt,
                                "PP"
                              )}
                            </p>
                          </div>
                        </div>
                        <Badge>{membership.role}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Building className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No organization memberships found</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}