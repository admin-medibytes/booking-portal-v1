"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "@tanstack/react-form";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, EyeOff } from "lucide-react";

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
  },
  user: {
    firstName: string;
    lastName: string;
    jobTitle: string;
  }
  
}

// Password strength calculation
const calculatePasswordStrength = (password: string): number => {
  let strength = 0;
  if (password.length >= 8) strength++;
  if (password.length >= 12) strength++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
  if (/\d/.test(password)) strength++;
  if (/[^a-zA-Z\d]/.test(password)) strength++;
  return strength;
};

const getStrengthLabel = (strength: number): string => {
  switch (strength) {
    case 0:
    case 1:
      return "Weak";
    case 2:
      return "Fair";
    case 3:
      return "Good";
    case 4:
      return "Strong";
    case 5:
      return "Very Strong";
    default:
      return "Weak";
  }
};

const getStrengthColor = (strength: number): string => {
  switch (strength) {
    case 0:
    case 1:
      return "bg-red-500";
    case 2:
      return "bg-orange-500";
    case 3:
      return "bg-yellow-500";
    case 4:
      return "bg-green-500";
    case 5:
      return "bg-green-600";
    default:
      return "bg-gray-200";
  }
};

export function AcceptInvitationForm({ invitation, user }: AcceptInvitationFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  const form = useForm({
    defaultValues: {
      password: "",
      confirmPassword: "",
      firstName: user.firstName,
      lastName: user.lastName,
      jobTitle: user.jobTitle,
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
          setError(signInResult.error.message || signInResult.error.code || "Failed to sign in");
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
          {(field) => {
            // Update password strength when value changes
            const handlePasswordChange = (value: string) => {
              field.handleChange(value);
              setPasswordStrength(calculatePasswordStrength(value));
            };

            return (
              <div>
                <Label htmlFor="password">Password</Label>
                <div className="relative mt-1">
                  <Input
                    id="password"
                    type={isPasswordVisible ? "text" : "password"}
                    required
                    value={field.state.value}
                    onChange={(e) => handlePasswordChange(e.target.value)}
                    onBlur={field.handleBlur}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    aria-label={isPasswordVisible ? "Hide password" : "Show password"}
                  >
                    {isPasswordVisible ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                </div>

                {/* Password Strength Indicator */}
                {field.state.value && (
                  <div className="mt-2 space-y-1">
                    <div className="flex gap-1">
                      {[...Array(5)].map((_, index) => (
                        <div
                          key={index}
                          className={`h-1 flex-1 rounded-full transition-colors ${
                            index < passwordStrength
                              ? getStrengthColor(passwordStrength)
                              : "bg-gray-200"
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Strength:{" "}
                      <span className={`font-medium`}>{getStrengthLabel(passwordStrength)}</span>
                    </p>
                  </div>
                )}

                {field.state.meta.errors.length > 0 && (
                  <p className="mt-1 text-sm text-red-600">{field.state.meta.errors[0]}</p>
                )}
              </div>
            );
          }}
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
              <div className="relative mt-1">
                <Input
                  id="confirmPassword"
                  type={isConfirmPasswordVisible ? "text" : "password"}
                  required
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setIsConfirmPasswordVisible(!isConfirmPasswordVisible)}
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  aria-label={isConfirmPasswordVisible ? "Hide password" : "Show password"}
                >
                  {isConfirmPasswordVisible ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </div>
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
