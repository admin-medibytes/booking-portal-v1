"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { type } from "arktype";
import { useForm } from "@tanstack/react-form";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle } from "lucide-react";
import Link from "next/link";

const resetPasswordSchema = type({
  newPassword: "string>=8",
  confirmPassword: "string>=8",
});

type ResetPasswordFormData = typeof resetPasswordSchema.infer;

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const tokenParam = searchParams.get("token");
    if (tokenParam) {
      setToken(tokenParam);
    } else {
      setError("Invalid reset link. Please request a new password reset.");
    }
  }, [searchParams]);

  const form = useForm({
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    } as ResetPasswordFormData,
    onSubmit: async ({ value }) => {
      try {
        setError(null);

        if (!token) {
          setError("Invalid reset token");
          return;
        }

        if (value.newPassword !== value.confirmPassword) {
          setError("Passwords do not match");
          return;
        }

        const result = await authClient.resetPassword({
          newPassword: value.newPassword,
          token,
        });

        if (result.error) {
          setError(result.error.message || "Failed to reset password");
          return;
        }

        setSuccess(true);
        setTimeout(() => {
          router.push("/login");
        }, 3000);
      } catch (err) {
        setError("An unexpected error occurred");
        console.error(err);
      }
    },
  });

  if (success) {
    return (
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-green-600 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Password reset successful</h3>
            <p className="text-sm text-gray-600 mb-6">
              Your password has been reset. Redirecting to sign in...
            </p>
            <Link
              href="/login"
              className="text-sm font-medium text-blue-600 hover:text-blue-500"
            >
              Go to sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 space-y-6"
      >
        <div className="space-y-4">
          <form.Field
            name="newPassword"
            validators={{
              onChange: ({ value }) => {
                const result = type({ password: "string>=8" })({ password: value });
                if (result instanceof type.errors) {
                  return "Password must be at least 8 characters";
                }
                return undefined;
              },
            }}
          >
            {(field) => (
              <div>
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
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
                if (value !== fieldApi.form.state.values.newPassword) {
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
            <Button
              type="submit"
              className="w-full"
              disabled={!canSubmit || isSubmitting || !token}
            >
              {isSubmitting ? "Resetting..." : "Reset password"}
            </Button>
          )}
        </form.Subscribe>
      </form>
    </div>
  );
}