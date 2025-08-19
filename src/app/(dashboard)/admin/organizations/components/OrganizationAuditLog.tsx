"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Clock, User } from "lucide-react";
import { format } from "date-fns";

interface AuditLogEntry {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  changes?: Record<string, unknown> | null;
  createdAt: string;
}

interface OrganizationAuditLogProps {
  auditHistory: AuditLogEntry[];
}

export function OrganizationAuditLog({ auditHistory }: OrganizationAuditLogProps) {
  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      "organization.created": "Organization Created",
      "organization.updated": "Organization Updated",
      "organization.deleted": "Organization Deleted",
      "team.created": "Team Created",
      "team.updated": "Team Updated",
      "team.deleted": "Team Deleted",
      "member.added": "Member Added",
      "member.removed": "Member Removed",
      "member.role_changed": "Member Role Changed",
    };
    return labels[action] || action;
  };

  const getActionVariant = (
    action: string
  ): "default" | "secondary" | "destructive" | "outline" => {
    if (action.includes("created") || action.includes("added")) return "default";
    if (action.includes("updated") || action.includes("changed")) return "secondary";
    if (action.includes("deleted") || action.includes("removed")) return "destructive";
    return "outline";
  };

  if (auditHistory.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Audit Log</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">No audit log entries found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit Log</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-4">
            {auditHistory.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start space-x-3 pb-4 border-b last:border-0"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={getActionVariant(entry.action)}>
                      {getActionLabel(entry.action)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      <span>User: {entry.userId}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{format(new Date(entry.createdAt), "PPp")}</span>
                    </div>
                  </div>
                  {entry.changes && Object.keys(entry.changes).length > 0 && (
                    <div className="mt-2 text-sm">
                      <details className="cursor-pointer">
                        <summary className="text-muted-foreground hover:text-foreground">
                          View details
                        </summary>
                        <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                          {JSON.stringify(entry.changes, null, 2)}
                        </pre>
                      </details>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
