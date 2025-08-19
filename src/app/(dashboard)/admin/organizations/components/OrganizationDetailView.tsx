"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Mail, Users } from "lucide-react";
import { format } from "date-fns";

interface OrganizationDetailViewProps {
  organization: {
    id: string;
    name: string;
    slug: string;
    contactEmail?: string;
    phone?: string;
    address?: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
    };
    metadata?: {
      isActive?: boolean;
    };
    createdAt: string;
    memberCount?: number;
    teamCount?: number;
    invitations?: Array<{ status: string }>;
  };
}

export function OrganizationDetailView({ organization }: OrganizationDetailViewProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Organization Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Name</p>
            <p className="font-medium">{organization.name}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Slug</p>
            <p className="font-medium">{organization.slug}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <Badge variant={organization.metadata?.isActive === false ? "secondary" : "default"}>
              {organization.metadata?.isActive === false ? "Inactive" : "Active"}
            </Badge>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Created</p>
            <p className="font-medium">
              {format(new Date(organization.createdAt), "PPP")}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Contact Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {organization.contactEmail && (
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{organization.contactEmail}</p>
            </div>
          )}
          {organization.phone && (
            <div>
              <p className="text-sm text-muted-foreground">Phone</p>
              <p className="font-medium">{organization.phone}</p>
            </div>
          )}
          {organization.address && (
            <div>
              <p className="text-sm text-muted-foreground">Address</p>
              <p className="font-medium">
                {organization.address.street}<br />
                {organization.address.city}, {organization.address.state} {organization.address.zipCode}<br />
                {organization.address.country}
              </p>
            </div>
          )}
          {!organization.contactEmail && !organization.phone && !organization.address && (
            <p className="text-muted-foreground">No contact information provided</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Statistics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Total Members</span>
            <span className="font-medium">{organization.memberCount || 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Total Teams</span>
            <span className="font-medium">{organization.teamCount || 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Pending Invitations</span>
            <span className="font-medium">
              {organization.invitations?.filter((inv) => inv.status === "pending").length || 0}
            </span>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}