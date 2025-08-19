"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { adminClient } from "@/lib/hono-client";
import { toast } from "sonner";

interface OrganizationEditFormProps {
  organization: {
    id: string;
    name: string;
    contactEmail?: string;
    phone?: string;
    address?: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
    };
  };
  onCancel: () => void;
  onSuccess: () => void;
}

export function OrganizationEditForm({
  organization,
  onCancel,
  onSuccess,
}: OrganizationEditFormProps) {
  const form = useForm({
    defaultValues: {
      name: organization.name || "",
      contactEmail: organization.contactEmail || "",
      phone: organization.phone || "",
      address: {
        street: organization.address?.street || "",
        city: organization.address?.city || "",
        state: organization.address?.state || "",
        zipCode: organization.address?.zipCode || "",
        country: organization.address?.country || "USA",
      },
    },
    onSubmit: async ({ value }) => {
      const hasAddress = Object.values(value.address).some(v => v);

      const updateData: Record<string, unknown> = {
        name: value.name,
        contactEmail: value.contactEmail || undefined,
        phone: value.phone || undefined,
      };

      if (hasAddress) {
        updateData.address = value.address;
      }

      updateMutation.mutate(updateData);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const response = await adminClient.organizations[":id"].$put({
        param: { id: organization.id },
        json: data,
      });
      
      if (!response.ok) {
        const error = await response.json() as { message?: string };
        throw new Error(error.message || "Failed to update organization");
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast.success("Organization updated successfully");
      onSuccess();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update organization");
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="space-y-6"
    >
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <form.Field name="name">
                {(field) => (
                  <>
                    <Label htmlFor="name">Organization Name *</Label>
                    <Input
                      id="name"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      required
                    />
                  </>
                )}
              </form.Field>
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
                      />
                    </>
                  )}
                </form.Field>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Address</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <form.Field name="address.street">
                {(field) => (
                  <>
                    <Label htmlFor="street">Street Address</Label>
                    <Input
                      id="street"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
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
                      />
                    </>
                  )}
                </form.Field>
              </div>
            </div>
          </CardContent>
        </Card>


        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Save Changes
          </Button>
        </div>
    </form>
  );
}