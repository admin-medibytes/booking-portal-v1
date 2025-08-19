"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
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
import { Loader2 } from "lucide-react";
import { adminClient } from "@/lib/hono-client";
import { toast } from "sonner";

interface Team {
  id: string;
  name: string;
  organizationId: string;
}

interface TeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  team?: Team;
  onSuccess: () => void;
}

export function TeamDialog({
  open,
  onOpenChange,
  organizationId,
  team,
  onSuccess,
}: TeamDialogProps) {
  const isEdit = !!team;

  const form = useForm({
    defaultValues: {
      name: team?.name || "",
    },
    onSubmit: async ({ value }) => {
      if (!value.name.trim()) {
        toast.error("Team name is required");
        return;
      }

      if (value.name.length < 2) {
        toast.error("Team name must be at least 2 characters");
        return;
      }

      mutation.mutate(value);
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: { name: string }) => {
      if (isEdit) {
        const response = await adminClient.teams[":teamId"].$put({
          param: { teamId: team.id },
          json: data,
        });
        
        if (!response.ok) {
          const error = await response.json() as { message?: string };
          throw new Error(error.message || "Failed to update team");
        }
        
        return await response.json();
      } else {
        const response = await adminClient.organizations[":orgId"].teams.$post({
          param: { orgId: organizationId },
          json: {
            ...data,
            organizationId,
          },
        });
        
        if (!response.ok) {
          const error = await response.json() as { message?: string };
          throw new Error(error.message || "Failed to create team");
        }
        
        return await response.json();
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Team updated successfully" : "Team created successfully");
      form.reset();
      onSuccess();
    },
    onError: (error: Error) => {
      toast.error(error.message || `Failed to ${isEdit ? "update" : "create"} team`);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Team" : "Create Team"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update the team name" : "Add a new team to this organization"}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="space-y-4"
        >
            <div className="space-y-2">
              <form.Field name="name">
                {(field) => (
                  <>
                    <Label htmlFor="name">Team Name *</Label>
                    <Input
                      id="name"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="e.g., Emergency Department, Legal Team"
                      required
                      autoFocus
                    />
                  </>
                )}
              </form.Field>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isEdit ? "Update Team" : "Create Team"}
              </Button>
            </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}