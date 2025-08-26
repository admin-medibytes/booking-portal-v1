"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

interface TwoFactorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function TwoFactorModal({ open, onOpenChange, onSuccess }: TwoFactorModalProps) {
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationMethod, setVerificationMethod] = useState<"totp" | "backup">("totp");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      let result;

      if (verificationMethod === "totp") {
        result = await authClient.twoFactor.verifyTotp({
          code,
          trustDevice: true,
        });
      } else {
        result = await authClient.twoFactor.verifyBackupCode({
          code,
          trustDevice: true,
        });
      }

      if (result.error) {
        setError(result.error.message || "Invalid verification code");
        return;
      }

      if (result.data) {
        toast.success("Two-factor authentication verified successfully");

        // Clear the form
        setCode("");
        setError(null);

        // Call success callback
        onSuccess();
      }
    } catch (err) {
      console.error("2FA verification error:", err);
      setError("An error occurred during verification");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[425px]">
        <AlertDialogHeader>
          <AlertDialogTitle>Two-Factor Authentication</AlertDialogTitle>
          <AlertDialogDescription>
            Enter the verification code from your authenticator app
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="2fa-code">
              {verificationMethod === "totp" ? "Verification Code" : "Backup Code"}
            </Label>
            <Input
              id="2fa-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={verificationMethod === "totp" ? "000000" : "Enter backup code"}
              maxLength={verificationMethod === "totp" ? 6 : undefined}
              pattern={verificationMethod === "totp" ? "[0-9]*" : undefined}
              inputMode={verificationMethod === "totp" ? "numeric" : "text"}
              autoComplete="one-time-code"
              required
              className="mt-1"
              autoFocus
            />
          </div>

          <div className="text-sm">
            {verificationMethod === "totp" ? (
              <button
                type="button"
                onClick={() => {
                  setVerificationMethod("backup");
                  setCode("");
                  setError(null);
                }}
                className="text-blue-600 hover:text-blue-500"
              >
                Use backup code instead
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setVerificationMethod("totp");
                  setCode("");
                  setError(null);
                }}
                className="text-blue-600 hover:text-blue-500"
              >
                Use authenticator app instead
              </button>
            )}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !code} className="flex-1">
              {isLoading ? "Verifying..." : "Verify"}
            </Button>
          </div>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
