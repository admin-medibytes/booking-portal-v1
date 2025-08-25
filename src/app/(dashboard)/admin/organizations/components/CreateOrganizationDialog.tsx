"use client";

import { useMemo, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { debounce } from "@/lib/debounce";

type OrganizationData = {
  name: string;
  slug: string;
};

interface CreateOrganizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateOrganizationDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateOrganizationDialogProps) {
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm({
    defaultValues: {
      name: "",
      slug: "",
    },
    onSubmit: async ({ value }) => {
      // Check required fields
      if (!value.name || !value.slug) {
        toast.error("Name and slug are required");
        return;
      }

      createMutation.mutate(value);
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: OrganizationData) => {
      const response = await adminClient.organizations.$post({
        json: data,
      });

      if (!response.ok) {
        const error = (await response.json()) as { message?: string };
        throw new Error(error.message || "Failed to create organization");
      }

      return await response.json();
    },
    onSuccess: () => {
      toast.success("Organization created successfully");
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      form.reset();
      onSuccess();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create organization");
    },
  });

  // Create a stable debounced function
  const debouncedCheckSlugAvailability = useMemo(
    () =>
      debounce(async (slug: string) => {
        if (!slug) {
          setSlugAvailable(null);
          return;
        }

        setCheckingSlug(true);
        try {
          const response = await adminClient.organizations["check-slug"].$post({
            json: { slug },
          });

          if (response.ok) {
            const data = await response.json();
            setSlugAvailable(data.available);
          } else {
            setSlugAvailable(null);
          }
        } catch {
          setSlugAvailable(null);
        } finally {
          setCheckingSlug(false);
        }
      }, 500),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Organization</DialogTitle>
          <DialogDescription>Add a new organization to the system</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <form.Field name="name">
                {(field) => (
                  <>
                    <Label htmlFor="name">Organization Name *</Label>
                    <Input
                      id="name"
                      value={field.state.value}
                      onChange={(e) => {
                        field.handleChange(e.target.value);
                        const slug = generateSlug(e.target.value);
                        form.setFieldValue("slug", slug);
                        debouncedCheckSlugAvailability(slug);
                      }}
                      placeholder="Medical Clinic Inc."
                      required
                    />
                  </>
                )}
              </form.Field>
            </div>

            <div className="space-y-2">
              <form.Field name="slug">
                {(field) => (
                  <>
                    <Label htmlFor="slug">Slug *</Label>
                    <div className="relative">
                      <Input
                        id="slug"
                        value={field.state.value}
                        onChange={(e) => {
                          field.handleChange(e.target.value);
                          debouncedCheckSlugAvailability(e.target.value);
                        }}
                        placeholder="medical-clinic"
                        required
                        className={
                          slugAvailable === false
                            ? "border-red-500"
                            : slugAvailable === true
                              ? "border-green-500"
                              : ""
                        }
                      />
                      {checkingSlug && (
                        <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin" />
                      )}
                    </div>
                    {slugAvailable === false && (
                      <p className="mt-1 text-sm text-red-500">This slug is already taken</p>
                    )}
                    {slugAvailable === true && (
                      <p className="mt-1 text-sm text-green-500">This slug is available</p>
                    )}
                  </>
                )}
              </form.Field>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending || slugAvailable === false}>
              {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Organization
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
