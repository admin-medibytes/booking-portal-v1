"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { type } from "arktype";
import { useForm } from "@tanstack/react-form";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

type AcceptInvitationFormData = {
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
};

interface AcceptInvitationFormProps {
  invitation: {
    id: string;
    email: string;
    organizationName: string | null;
    role: string | null;
    teamId: string | null;
  };
}

export function AcceptInvitationForm({ invitation }: AcceptInvitationFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      password: "",
      confirmPassword: "",
      firstName: "",
      lastName: "",
      jobTitle: "",
    } as AcceptInvitationFormData,
    onSubmit: async ({ value }) => {
      try {
        setError(null);

        if (value.password !== value.confirmPassword) {
          setError("Passwords do not match");
          return;
        }

        // Accept the invitation and create account
        const response = await fetch("/api/public/accept-invitation", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            invitationId: invitation.id,
            email: invitation.email,
            password: value.password,
            firstName: value.firstName,
            lastName: value.lastName,
            jobTitle: value.jobTitle,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          setError(result.message || "Failed to accept invitation");
          return;
        }

        // Sign in automatically
        const signInResult = await authClient.signIn.email({
          email: invitation.email,
          password: value.password,
        });

        if (signInResult.error) {
          setError(signInResult.error.message || "Failed to sign in");
          return;
        }

        // Redirect to root which handles role-based routing
        router.push("/");
      } catch (err) {
        setError("An unexpected error occurred");
        console.error(err);
      }
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
      <div>
        <h2 className="text-lg font-medium text-gray-900">Create Your Account</h2>
        <p className="mt-1 text-sm text-gray-600">
          You&apos;re joining as a <span className="font-medium">{invitation.role}</span>
          {invitation.organizationName && ` at ${invitation.organizationName}`}
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <Label>Email</Label>
          <Input type="email" value={invitation.email} disabled className="mt-1 bg-gray-50" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <form.Field
            name="firstName"
            validators={{
              onChange: ({ value }) => {
                if (!value || value.length < 1) {
                  return "First name is required";
                }
                return undefined;
              },
            }}
          >
            {(field) => (
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  type="text"
                  required
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  className="mt-1"
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="mt-1 text-sm text-red-600">{field.state.meta.errors[0]}</p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field
            name="lastName"
            validators={{
              onChange: ({ value }) => {
                if (!value || value.length < 1) {
                  return "Last name is required";
                }
                return undefined;
              },
            }}
          >
            {(field) => (
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  type="text"
                  required
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  className="mt-1"
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="mt-1 text-sm text-red-600">{field.state.meta.errors[0]}</p>
                )}
              </div>
            )}
          </form.Field>
        </div>

        <form.Field
          name="jobTitle"
          validators={{
            onChange: ({ value }) => {
              if (!value || value.length < 2) {
                return "Job title must be at least 2 characters";
              }
              return undefined;
            },
          }}
        >
          {(field) => (
            <div>
              <Label htmlFor="jobTitle">Job Title</Label>
              <Input
                id="jobTitle"
                type="text"
                required
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                className="mt-1"
                placeholder={
                  invitation.role === "specialist"
                    ? "e.g., Orthopedic Surgeon"
                    : "e.g., Claims Manager"
                }
              />
              {field.state.meta.errors.length > 0 && (
                <p className="mt-1 text-sm text-red-600">{field.state.meta.errors[0]}</p>
              )}
            </div>
          )}
        </form.Field>

        <form.Field
          name="password"
          validators={{
            onChange: ({ value }) => {
              if (!value || value.length < 8) {
                return "Password must be at least 8 characters";
              }
              return undefined;
            },
          }}
        >
          {(field) => (
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                className="mt-1"
              />
              {field.state.meta.errors.length > 0 && (
                <p className="mt-1 text-sm text-red-600">{field.state.meta.errors[0]}</p>
              )}
            </div>
          )}
        </form.Field>

        <form.Field
          name="confirmPassword"
          validators={{
            onChange: ({ value, fieldApi }) => {
              if (value !== fieldApi.form.state.values.password) {
                return "Passwords do not match";
              }
              return undefined;
            },
          }}
        >
          {(field) => (
            <div>
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                required
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                className="mt-1"
              />
              {field.state.meta.errors.length > 0 && (
                <p className="mt-1 text-sm text-red-600">{field.state.meta.errors[0]}</p>
              )}
            </div>
          )}
        </form.Field>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
        {([canSubmit, isSubmitting]) => (
          <Button type="submit" className="w-full" disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? "Creating account..." : "Accept & Create Account"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
