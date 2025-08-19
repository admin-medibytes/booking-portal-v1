"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, Edit2, Trash2, Users } from "lucide-react";
import { adminClient } from "@/lib/hono-client";
import { toast } from "sonner";
import { TeamDialog } from "./TeamDialog";

interface Team {
  id: string;
  name: string;
  organizationId: string;
  createdAt: string;
}

interface TeamManagementProps {
  organizationId: string;
  teams: Team[];
  onRefresh: () => void;
}

export function TeamManagement({ organizationId, teams, onRefresh }: TeamManagementProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [deletingTeam, setDeletingTeam] = useState<Team | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (teamId: string) => {
      const response = await adminClient.teams[":teamId"].$delete({
        param: { teamId },
      });
      
      if (!response.ok) {
        const error = await response.json() as { message?: string };
        throw new Error(error.message || "Failed to delete team");
      }
    },
    onSuccess: () => {
      toast.success("Team deleted successfully");
      setDeletingTeam(null);
      onRefresh();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete team");
    },
  });

  const handleTeamCreated = () => {
    setIsCreateDialogOpen(false);
    onRefresh();
  };

  const handleTeamUpdated = () => {
    setEditingTeam(null);
    onRefresh();
  };

  const canDeleteTeam = teams.length > 1;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Teams ({teams.length})
            </CardTitle>
            <Button onClick={() => setIsCreateDialogOpen(true)} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Create Team
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {teams.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No teams created yet. Create your first team to get started.
            </p>
          ) : (
            <div className="space-y-2">
              {teams.map((team) => (
                <div
                  key={team.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div>
                    <p className="font-medium">{team.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Created: {new Date(team.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingTeam(team)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    {canDeleteTeam && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletingTeam(team)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {teams.length === 1 && (
            <p className="text-sm text-muted-foreground mt-4">
              Note: Organizations must have at least one team. The last team cannot be deleted.
            </p>
          )}
        </CardContent>
      </Card>

      <TeamDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        organizationId={organizationId}
        onSuccess={handleTeamCreated}
      />

      {editingTeam && (
        <TeamDialog
          open={true}
          onOpenChange={(open) => !open && setEditingTeam(null)}
          organizationId={organizationId}
          team={editingTeam}
          onSuccess={handleTeamUpdated}
        />
      )}

      <AlertDialog open={!!deletingTeam} onOpenChange={(open) => !open && setDeletingTeam(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Team</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the team &quot;{deletingTeam?.name}&quot;? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingTeam && deleteMutation.mutate(deletingTeam.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Team
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}