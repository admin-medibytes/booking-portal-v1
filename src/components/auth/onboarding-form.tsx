"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { type } from "arktype";
import { useForm } from "@tanstack/react-form";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { QRCodeSVG } from "qrcode.react";

const passwordSchema = type({
  newPassword: "string>=8",
  confirmPassword: "string>=8",
  "enable2FA?": "boolean",
});

type PasswordFormData = typeof passwordSchema.infer;

export function OnboardingForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"password" | "2fa">("password");

  const form = useForm({
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
      enable2FA: false,
    } as PasswordFormData,
    onSubmit: async ({ value }) => {
      try {
        setError(null);

        if (value.newPassword !== value.confirmPassword) {
          setError("Passwords do not match");
          return;
        }

        // Use our custom endpoint for initial password setup
        const response = await fetch("/api/user/set-initial-password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            newPassword: value.newPassword,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          setError(result.error || "Failed to set password");
          return;
        }

        if (value.enable2FA) {
          setStep("2fa");
          // Store the password temporarily for 2FA setup
          sessionStorage.setItem("temp_2fa_pwd", value.newPassword);
        } else {
          // Redirect to root which handles role-based routing
          router.push("/");
        }
      } catch (err) {
        setError("An unexpected error occurred");
        console.error(err);
      }
    },
  });

  if (step === "2fa") {
    return (
      <TwoFactorSetup
        onComplete={() => {
          // Redirect to root which handles role-based routing
          router.push("/");
        }}
      />
    );
  }

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
        <h2 className="text-lg font-medium text-gray-900">Set Your Password</h2>
        <p className="mt-1 text-sm text-gray-600">Create a secure password for your account</p>
      </div>

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

        <form.Field name="enable2FA">
          {(field) => (
            <div className="flex items-center">
              <Checkbox
                id="enable2FA"
                checked={field.state.value}
                onCheckedChange={(checked) => field.handleChange(checked === true)}
              />
              <Label
                htmlFor="enable2FA"
                className="block ml-2 text-sm text-gray-900 cursor-pointer"
              >
                Enable Two-Factor Authentication (Recommended)
              </Label>
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
            {isSubmitting ? "Setting up..." : "Continue"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}

function TwoFactorSetup({ onComplete }: { onComplete: () => void }) {
  const [totpURI, setTotpURI] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verificationCode, setVerificationCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showBackupCodes, setShowBackupCodes] = useState(false);

  useEffect(() => {
    const setup2FA = async () => {
      try {
        // Retrieve the password from sessionStorage
        const tempPassword = sessionStorage.getItem("temp_2fa_pwd");
        if (!tempPassword) {
          setError("Password not found. Please try again.");
          return;
        }

        const result = await authClient.twoFactor.enable({
          password: tempPassword,
        });

        // Clear the temporary password after use
        sessionStorage.removeItem("temp_2fa_pwd");

        if (result.data) {
          setTotpURI(result.data.totpURI);
          setBackupCodes(result.data.backupCodes);
        }
      } catch (err) {
        setError("Failed to enable 2FA");
        // Clear the temporary password on error as well
        sessionStorage.removeItem("temp_2fa_pwd");
      }
    };
    setup2FA();

    // Cleanup: ensure password is removed if component unmounts
    return () => {
      sessionStorage.removeItem("temp_2fa_pwd");
    };
  }, []);

  const handleVerify = async () => {
    setError(null);
    setLoading(true);

    try {
      const result = await authClient.twoFactor.verifyTotp({
        code: verificationCode,
      });

      if (result.error) {
        setError(result.error.message || "Invalid code");
        return;
      }

      onComplete();
    } catch (err) {
      setError("Failed to verify code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-gray-900">Set Up Two-Factor Authentication</h2>
        <p className="mt-1 text-sm text-gray-600">Scan this QR code with your authenticator app</p>
      </div>

      {totpURI && (
        <div className="flex flex-col items-center space-y-4">
          <div className="p-4 bg-white border rounded-lg">
            <QRCodeSVG value={totpURI} size={192} />
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">Can&apos;t scan? Enter this URI manually:</p>
            <code className="block px-2 py-1 mt-1 font-mono text-xs break-all bg-gray-100 rounded">
              {totpURI}
            </code>
          </div>
        </div>
      )}

      {!showBackupCodes && backupCodes.length > 0 && (
        <Button
          type="button"
          variant="link"
          className="text-sm"
          onClick={() => setShowBackupCodes(true)}
        >
          Show backup codes
        </Button>
      )}

      {showBackupCodes && backupCodes.length > 0 && (
        <div className="p-4 rounded-lg bg-gray-50">
          <p className="mb-2 text-sm font-medium text-gray-900">
            Backup Codes (save these somewhere safe):
          </p>
          <div className="grid grid-cols-2 gap-2">
            {backupCodes.map((code, index) => (
              <code key={index} className="px-2 py-1 font-mono text-xs bg-white rounded">
                {code}
              </code>
            ))}
          </div>
        </div>
      )}

      <div>
        <Label htmlFor="code">Verification Code</Label>
        <Input
          id="code"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={verificationCode}
          onChange={(e) => setVerificationCode(e.target.value)}
          className="mt-1"
          placeholder="000000"
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-4">
        <Button variant="outline" className="flex-1" onClick={onComplete}>
          Skip for now
        </Button>
        <Button
          className="flex-1"
          onClick={handleVerify}
          disabled={verificationCode.length !== 6 || loading}
        >
          {loading ? "Verifying..." : "Verify & Continue"}
        </Button>
      </div>
    </div>
  );
}
