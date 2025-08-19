"use client";

import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { type } from "arktype";
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

const organizationSchema = type({
  name: "2<=string<=100",
  slug: "string",
  "contactEmail?": "string.email",
  "phone?": "string",
  "address?": {
    street: "string",
    city: "string",
    state: "string",
    zipCode: "string",
    country: "string",
  },
});

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

  const form = useForm({
    defaultValues: {
      name: "",
      slug: "",
      contactEmail: "",
      phone: "",
      address: {
        street: "",
        city: "",
        state: "",
        zipCode: "",
        country: "USA",
      },
    },
    onSubmit: async ({ value }) => {
      const validationResult = organizationSchema(value);
      if (validationResult instanceof type.errors) {
        const firstError = validationResult[0].message;
        toast.error(firstError);
        return;
      }

      createMutation.mutate(value);
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form.state.values) => {
      const response = await adminClient.organizations.$post({
        json: data,
      });

      if (!response.ok) {
        const error = await response.json() as { message?: string };
        throw new Error(error.message || "Failed to create organization");
      }

      return await response.json();
    },
    onSuccess: () => {
      toast.success("Organization created successfully");
      form.reset();
      onSuccess();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create organization");
    },
  });

  const checkSlugAvailability = async (slug: string) => {
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
  };

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
                          checkSlugAvailability(slug);
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
                            checkSlugAvailability(e.target.value);
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
                        <p className="text-sm text-red-500 mt-1">This slug is already taken</p>
                      )}
                      {slugAvailable === true && (
                        <p className="text-sm text-green-500 mt-1">This slug is available</p>
                      )}
                    </>
                  )}
                </form.Field>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <form.Field name="contactEmail">
                  {(field) => (
                    <>
                      <Label htmlFor="contactEmail">Contact Email</Label>
                      <Input
                        id="contactEmail"
                        type="email"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="contact@organization.com"
                      />
                    </>
                  )}
                </form.Field>
              </div>

              <div className="space-y-2">
                <form.Field name="phone">
                  {(field) => (
                    <>
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="+1 (555) 123-4567"
                      />
                    </>
                  )}
                </form.Field>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-medium">Address (Optional)</h3>

              <div className="space-y-2">
                <form.Field name="address.street">
                  {(field) => (
                    <>
                      <Label htmlFor="street">Street Address</Label>
                      <Input
                        id="street"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="123 Main St"
                      />
                    </>
                  )}
                </form.Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <form.Field name="address.city">
                    {(field) => (
                      <>
                        <Label htmlFor="city">City</Label>
                        <Input
                          id="city"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder="New York"
                        />
                      </>
                    )}
                  </form.Field>
                </div>

                <div className="space-y-2">
                  <form.Field name="address.state">
                    {(field) => (
                      <>
                        <Label htmlFor="state">State</Label>
                        <Input
                          id="state"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder="NY"
                        />
                      </>
                    )}
                  </form.Field>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <form.Field name="address.zipCode">
                    {(field) => (
                      <>
                        <Label htmlFor="zipCode">ZIP Code</Label>
                        <Input
                          id="zipCode"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder="10001"
                        />
                      </>
                    )}
                  </form.Field>
                </div>

                <div className="space-y-2">
                  <form.Field name="address.country">
                    {(field) => (
                      <>
                        <Label htmlFor="country">Country</Label>
                        <Input
                          id="country"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder="USA"
                        />
                      </>
                    )}
                  </form.Field>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || slugAvailable === false}>
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Organization
              </Button>
            </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
