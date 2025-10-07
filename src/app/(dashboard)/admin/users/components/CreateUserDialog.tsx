"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminClient, specialistsClient } from "@/lib/hono-client";
import { generateSlug } from "@/lib/utils/slug";
import { debounce } from "@/lib/debounce";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, Plus, User, Building, Shield, Phone, Mail, Briefcase } from "lucide-react";

import { Separator } from "@/components/ui/separator";

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateUserDialog({ open, onOpenChange }: CreateUserDialogProps) {
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);
  const queryClient = useQueryClient();

  // Fetch organizations
  const { data: orgsData } = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const response = await adminClient.organizations.$get({ query: {} });
      if (!response.ok) throw new Error("Failed to fetch organizations");
      const data = await response.json();
      return data;
    },
  });

  // Fetch teams for selected organization
  const { data: teamsData } = useQuery({
    queryKey: ["teams", selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return { teams: [] };
      const response = await adminClient.organizations[":orgId"].teams.$get({
        param: { orgId: selectedOrgId },
      });
      if (!response.ok) throw new Error("Failed to fetch teams");
      return response.json();
    },
    enabled: !!selectedOrgId,
  });

  // Debounced slug check function
  const debouncedCheckSlugAvailability = useMemo(
    () =>
      debounce(async (slug: string) => {
        if (!slug) {
          setSlugAvailable(null);
          return;
        }

        setCheckingSlug(true);
        try {
          const response = await specialistsClient["check-slug"].$post({
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
    []
  );

  const createUserMutation = useMutation({
    mutationFn: async (values: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      jobTitle: string;
      organizationId: string;
      teamId: string;
      role: "referrer" | "specialist" | "admin";
      sendEmailInvitation: boolean;
      acuityCalendarId: number;
      slug?: string;
    }) => {
      const response = await adminClient.users.$post({
        json: values,
      });
      if (!response.ok) {
        const errorText = await response.text();
        try {
          const error = JSON.parse(errorText);
          throw new Error(error.message || "Failed to create user");
        } catch {
          throw new Error("Failed to create user");
        }
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success("User created successfully");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      onOpenChange(false);
      form.reset();
      setSlugAvailable(null);
      setCheckingSlug(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const form = useForm({
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      jobTitle: "",
      organizationId: "",
      teamId: "",
      role: "referrer" as "referrer" | "specialist" | "admin",
      sendEmailInvitation: true,
      acuityCalendarId: "",
      slug: "",
    },
    onSubmit: async ({ value }) => {
      // Validate required fields
      if (!value.firstName || !value.lastName || !value.email) {
        toast.error("Please fill in all required fields");
        return;
      }

      if (!value.organizationId || !value.teamId) {
        toast.error("Please select an organization and team");
        return;
      }

      if (value.role === "specialist") {
        if (!value.acuityCalendarId) {
          toast.error("Acuity Calendar ID is required for specialists");
          return;
        }
        if (!value.slug || value.slug === "") {
          toast.error("Slug is required for specialists");
          return;
        }
        if (slugAvailable === false) {
          toast.error("The selected slug is not available");
          return;
        }
      }

      await createUserMutation.mutateAsync({
        ...value,
        jobTitle: value.jobTitle || "N/A",
        acuityCalendarId: Number(value.acuityCalendarId),
        slug: value.role === "specialist" ? value.slug : undefined,
      });
    },
  });

  // Reset form state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      form.reset();
      setSlugAvailable(null);
      setCheckingSlug(false);
      setSelectedOrgId("");
    }
  }, [open, form]);

  // Auto-select first team when organization changes
  useEffect(() => {
    if (teamsData && teamsData.teams && teamsData.teams.length > 0) {
      form.setFieldValue("teamId", teamsData.teams[0].id);
    }
  }, [teamsData, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center mb-4 space-x-2 text-center">
            <div className="flex items-center justify-center w-12 h-12 border rounded-full border-stone-200 bg-muted">
              <User className="w-6 h-6 text-muted-foreground" />
            </div>
            <div className="inline-block ml-2 space-y-1 text-left">
              <DialogTitle>Create New User</DialogTitle>
              <DialogDescription>
                Add a new user to the system and assign them to an organization.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          <div className="space-y-6">
            {/* Personal Information Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">Personal Information</h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <form.Field name="firstName">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor="firstName" className="text-sm">
                        First Name <span className="text-destructive">*</span>
                      </Label>
                      <div className="relative">
                        <Input
                          id="firstName"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => {
                            field.handleChange(e.target.value);
                            // Auto-generate slug if specialist role is selected
                            if (form.state.values.role === "specialist") {
                              const slug = generateSlug(
                                `${e.target.value}-${form.state.values.lastName || ""}`
                              );
                              form.setFieldValue("slug", slug);
                              debouncedCheckSlugAvailability(slug);
                            }
                          }}
                          placeholder="John"
                          className="pr-8"
                        />
                      </div>
                    </div>
                  )}
                </form.Field>

                <form.Field name="lastName">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor="lastName" className="text-sm">
                        Last Name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="lastName"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => {
                          field.handleChange(e.target.value);
                          // Auto-generate slug if specialist role is selected
                          if (form.state.values.role === "specialist") {
                            const slug = generateSlug(
                              `${form.state.values.firstName || ""}-${e.target.value}`
                            );
                            form.setFieldValue("slug", slug);
                            debouncedCheckSlugAvailability(slug);
                          }
                        }}
                        placeholder="Doe"
                      />
                    </div>
                  )}
                </form.Field>
              </div>

              <form.Field name="email">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm">
                      Email <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Mail className="absolute w-4 h-4 -translate-y-1/2 left-3 top-1/2 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="john.doe@example.com"
                        className="pl-10"
                      />
                    </div>
                  </div>
                )}
              </form.Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <form.Field name="phone">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-sm">
                        Phone
                      </Label>
                      <div className="relative">
                        <Phone className="absolute w-4 h-4 -translate-y-1/2 left-3 top-1/2 text-muted-foreground" />
                        <Input
                          id="phone"
                          type="tel"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder="+1 (555) 123-4567"
                          className="pl-10"
                        />
                      </div>
                    </div>
                  )}
                </form.Field>

                <form.Field name="jobTitle">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor="jobTitle" className="text-sm">
                        Job Title
                      </Label>
                      <div className="relative">
                        <Briefcase className="absolute w-4 h-4 -translate-y-1/2 left-3 top-1/2 text-muted-foreground" />
                        <Input
                          id="jobTitle"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder="Attorney"
                          className="pl-10"
                        />
                      </div>
                    </div>
                  )}
                </form.Field>
              </div>
            </div>

            {/* Organization Assignment Section */}
            <div className="pt-4 space-y-4 border-t">
              <h3 className="text-sm font-medium text-muted-foreground">Organization Assignment</h3>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <form.Field name="organizationId">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor="organizationId" className="text-sm font-medium">
                        Organization <span className="text-destructive">*</span>
                      </Label>
                      <div className="relative">
                        <Building className="absolute z-10 w-4 h-4 -translate-y-1/2 pointer-events-none left-3 top-1/2 text-muted-foreground" />
                        <Select
                          value={field.state.value}
                          onValueChange={(value) => {
                            field.handleChange(value);
                            setSelectedOrgId(value);
                            form.setFieldValue("teamId", "");
                          }}
                        >
                          <SelectTrigger className="h-10 pl-10 w-full">
                            <SelectValue placeholder="Select an organization" />
                          </SelectTrigger>
                          <SelectContent>
                            {orgsData?.organizations?.map((org: { id: string; name: string }) => (
                              <SelectItem key={org.id} value={org.id}>
                                {org.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </form.Field>

                <form.Field name="teamId">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor="teamId" className="text-sm font-medium">
                        Team <span className="text-destructive">*</span>
                      </Label>
                      <div className="relative">
                        <Select
                          value={field.state.value}
                          onValueChange={(value) => field.handleChange(value)}
                          disabled={!selectedOrgId}
                        >
                          <SelectTrigger className="h-10 w-full">
                            <SelectValue
                              placeholder={
                                selectedOrgId ? "Select a team" : "Select organization first"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {teamsData?.teams?.map((team: { id: string; name: string }) => (
                              <SelectItem key={team.id} value={team.id}>
                                {team.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </form.Field>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <form.Field name="role">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor="role" className="text-sm font-medium">
                        Role <span className="text-destructive">*</span>
                      </Label>
                      <div className="relative">
                        <Shield className="absolute z-10 w-4 h-4 -translate-y-1/2 pointer-events-none left-3 top-1/2 text-muted-foreground" />
                        <Select
                          value={field.state.value}
                          onValueChange={(value: "referrer" | "specialist" | "admin") =>
                            field.handleChange(value)
                          }
                        >
                          <SelectTrigger className="h-10 pl-10 w-full">
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="referrer">Referrer</SelectItem>
                            <SelectItem value="specialist">Specialist</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </form.Field>

                <form.Subscribe selector={(state) => state.values.role}>
                  {(role) =>
                    role === "specialist" ? (
                      <div className="space-y-4">
                        <form.Field name="acuityCalendarId">
                          {(field) => (
                            <div className="space-y-2">
                              <Label htmlFor="acuityCalendarId" className="text-sm font-medium">
                                Acuity Calendar ID <span className="text-destructive">*</span>
                              </Label>
                              <Input
                                id="acuityCalendarId"
                                value={field.state.value}
                                onBlur={field.handleBlur}
                                onChange={(e) => field.handleChange(e.target.value)}
                                placeholder="12345678"
                                className="h-10"
                              />
                              <p className="text-xs text-muted-foreground">
                                For specialists to sync with Acuity Scheduling
                              </p>
                            </div>
                          )}
                        </form.Field>
                        <form.Field name="slug">
                          {(field) => {
                            // Generate initial slug if field is empty and names exist
                            const currentValue = field.state.value;
                            const firstName = form.state.values.firstName;
                            const lastName = form.state.values.lastName;

                            // If slug is empty and we have names, generate it
                            if (!currentValue && (firstName || lastName)) {
                              const generatedSlug = generateSlug(`${firstName}-${lastName}`);
                              // Set the value immediately
                              setTimeout(() => {
                                form.setFieldValue("slug", generatedSlug);
                                debouncedCheckSlugAvailability(generatedSlug);
                              }, 0);
                            }

                            return (
                              <div className="space-y-2">
                                <Label htmlFor="slug" className="text-sm font-medium">
                                  URL Slug <span className="text-destructive">*</span>
                                </Label>
                                <div className="relative">
                                  <Input
                                    id="slug"
                                    value={field.state.value || ""}
                                    onBlur={field.handleBlur}
                                    onChange={(e) => {
                                      field.handleChange(e.target.value);
                                      debouncedCheckSlugAvailability(e.target.value);
                                    }}
                                    placeholder="john-smith"
                                    className={`h-10 ${
                                      slugAvailable === false
                                        ? "border-red-500"
                                        : slugAvailable === true
                                          ? "border-green-500"
                                          : ""
                                    }`}
                                  />
                                  {checkingSlug && (
                                    <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin" />
                                  )}
                                </div>
                                {slugAvailable === false && (
                                  <p className="text-sm text-red-500">This slug is already taken</p>
                                )}
                                {slugAvailable === true && (
                                  <p className="text-sm text-green-500">This slug is available</p>
                                )}
                                <p className="text-xs text-muted-foreground">
                                  Unique URL identifier for the specialist&apos;s panel page
                                </p>
                              </div>
                            );
                          }}
                        </form.Field>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label className="invisible text-sm font-medium">Placeholder</Label>
                        <div className="h-10"></div>
                      </div>
                    )
                  }
                </form.Subscribe>
              </div>
            </div>

            <Separator className="my-4" />

            <form.Field name="sendEmailInvitation">
              {(field) => (
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="sendEmailInvitation"
                    checked={field.state.value}
                    onCheckedChange={(checked) => field.handleChange(checked as boolean)}
                  />
                  <div className="space-y-0.5">
                    <Label
                      htmlFor="sendEmailInvitation"
                      className="text-sm font-normal cursor-pointer"
                    >
                      Send invitation email
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      User will receive an email with login instructions
                    </p>
                  </div>
                </div>
              )}
            </form.Field>
          </div>

          <Separator className="my-4" />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createUserMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createUserMutation.isPending}>
              {createUserMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create User
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
