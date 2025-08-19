"use client";

import { useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Edit } from "lucide-react";
import Link from "next/link";
import { adminClient } from "@/lib/hono-client";
import { OrganizationDetailView } from "../components/OrganizationDetailView";
import { TeamManagement } from "../components/TeamManagement";
import { OrganizationEditForm } from "../components/OrganizationEditForm";
import { OrganizationAuditLog } from "../components/OrganizationAuditLog";

interface OrganizationMember {
  id: string;
  user: {
    name: string | null;
    email: string;
  };
  role: string;
}

export default function OrganizationDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const orgId = params.id as string;
  const isEditMode = searchParams.get("edit") === "true";
  const [editMode, setEditMode] = useState(isEditMode);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["organization", orgId],
    queryFn: async () => {
      const response = await adminClient.organizations[":id"].$get({
        param: { id: orgId },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch organization");
      }

      const result = await response.json();
      return result.organization;
    },
  });

  if (isLoading) {
    return (
      <div className="container py-8 mx-auto">
        <div className="animate-pulse">
          <div className="w-1/4 h-8 mb-4 bg-gray-200 rounded"></div>
          <div className="w-1/2 h-4 mb-8 bg-gray-200 rounded"></div>
          <div className="space-y-4">
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container py-8 mx-auto">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Organization not found</h2>
          <p className="mt-2 text-muted-foreground">
            The organization you&apos;re looking for doesn&apos;t exist.
          </p>
          <Button asChild className="mt-4">
            <Link href="/admin/organizations">Back to Organizations</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8 mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/admin/organizations">
                <ArrowLeft className="w-4 h-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{data.name}</h1>
              <p className="text-muted-foreground">{data.slug}</p>
            </div>
          </div>
          {!editMode && (
            <Button onClick={() => setEditMode(true)}>
              <Edit className="w-4 h-4 mr-2" />
              Edit Organization
            </Button>
          )}
        </div>
      </div>

      {editMode ? (
        <OrganizationEditForm
          organization={data}
          onCancel={() => setEditMode(false)}
          onSuccess={() => {
            setEditMode(false);
            refetch();
          }}
        />
      ) : (
        <Tabs defaultValue="details" className="space-y-4">
          <TabsList className="border">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="teams">Teams</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="audit">Audit Log</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
            <OrganizationDetailView organization={data} />
          </TabsContent>

          <TabsContent value="teams" className="space-y-4">
            <TeamManagement organizationId={orgId} teams={data.teams || []} onRefresh={refetch} />
          </TabsContent>

          <TabsContent value="members" className="space-y-4">
            <div className="p-6 border rounded-lg">
              <h3 className="mb-4 text-lg font-semibold">Members</h3>
              {data.members && data.members.length > 0 ? (
                <div className="space-y-2">
                  {data.members.map((member: OrganizationMember) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 border rounded"
                    >
                      <div>
                        <div className="font-medium">{member.user.name || member.user.email}</div>
                        <div className="text-sm text-muted-foreground">{member.user.email}</div>
                      </div>
                      <div className="text-sm text-muted-foreground">Role: {member.role}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No members yet</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="audit" className="space-y-4">
            <OrganizationAuditLog auditHistory={data.auditHistory || []} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
