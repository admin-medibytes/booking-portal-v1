"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { type } from "arktype";
import { useForm } from "@tanstack/react-form";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";
import { toast } from "sonner";
import { TwoFactorModal } from "./two-factor-modal";

type LoginFormData = {
  email: string;
  password: string;
  rememberMe?: boolean | undefined;
};

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [showTwoFactorModal, setShowTwoFactorModal] = useState(false);

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    } as LoginFormData,
    onSubmit: async ({ value }) => {
      try {
        setError(null);

        const result = await authClient.signIn.email({
          email: value.email,
          password: value.password,
          rememberMe: value.rememberMe,
        });

        if (result.error) {
          setError(result.error.message || "Failed to sign in");
          return;
        }

        if ("twoFactorRedirect" in result.data) {
          setShowTwoFactorModal(true);
          return;
        }

        if (result.data?.user) {
          const user = result.data.user;
          console.log("User data:", user);

          if (!user.emailVerified) {
            router.push("/verify?type=email");
            return;
          }

          const firstTimeLogin = !user.image;

          if (firstTimeLogin) {
            router.push("/onboarding");
            return;
          }

          router.push("/");
        } else {
          setError("Login successful but no user data received");
        }
      } catch (err) {
        console.error(err);
      }
    },
  });

  const handleTwoFactorSuccess = async () => {
    // Close the modal
    setShowTwoFactorModal(false);

    // Get the session to check user status
    const session = await authClient.getSession();

    if (session.data?.user) {
      const user = session.data.user;

      if (!user.emailVerified) {
        router.push("/verify?type=email");
        return;
      }

      const firstTimeLogin = !user.image;

      if (firstTimeLogin) {
        router.push("/onboarding");
        return;
      }

      toast.success("Login successful");
      // Redirect to root which handles role-based routing
      router.push("/");
      router.refresh();
    } else {
      // If no session, force redirect
      window.location.href = "/";
    }
  };

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="px-4 py-8 mt-8 space-y-6 bg-white shadow sm:rounded-lg sm:px-10"
      >
        <div className="space-y-4">
          <form.Field
            name="email"
            validators={{
              onChange: ({ value }) => {
                const result = type({ email: "string.email" })({ email: value });
                if (result instanceof type.errors) {
                  return result[0]?.message || "Invalid email";
                }
                return undefined;
              },
            }}
          >
            {(field) => (
              <div>
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  className="mt-1"
                  aria-invalid={field.state.meta.errors.length > 0}
                  aria-describedby={field.state.meta.errors.length > 0 ? "email-error" : undefined}
                />
                {field.state.meta.errors.length > 0 && (
                  <p id="email-error" className="mt-1 text-sm text-red-600">
                    {field.state.meta.errors[0]}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field
            name="password"
            validators={{
              onChange: ({ value }) => {
                const result = type({ password: "string>=8" })({ password: value });
                if (result instanceof type.errors) {
                  return result[0]?.message || "Invalid password";
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
                  autoComplete="current-password"
                  required
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  className="mt-1"
                  aria-invalid={field.state.meta.errors.length > 0}
                  aria-describedby={
                    field.state.meta.errors.length > 0 ? "password-error" : undefined
                  }
                />
                {field.state.meta.errors.length > 0 && (
                  <p id="password-error" className="mt-1 text-sm text-red-600">
                    {field.state.meta.errors[0]}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <div className="flex items-center justify-between">
            <form.Field name="rememberMe">
              {(field) => (
                <div className="flex items-center">
                  <Checkbox
                    id="remember-me"
                    checked={field.state.value}
                    onCheckedChange={(checked) => field.handleChange(checked === true)}
                  />
                  <Label
                    htmlFor="remember-me"
                    className="block ml-2 text-sm text-gray-900 cursor-pointer"
                  >
                    Remember me
                  </Label>
                </div>
              )}
            </form.Field>

            <Link href="/forgot-password" className="text-sm text-blue-600 hover:text-blue-500">
              Forgot your password?
            </Link>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
          {([canSubmit, isSubmitting]) => (
            <Button type="submit" className="w-full" disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? "Signing in..." : "Sign in"}
            </Button>
          )}
        </form.Subscribe>
      </form>

      <TwoFactorModal
        open={showTwoFactorModal}
        onOpenChange={setShowTwoFactorModal}
        onSuccess={handleTwoFactorSuccess}
      />
    </>
  );
}
