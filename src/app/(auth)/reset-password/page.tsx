import { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Reset Password - Medibytes",
  description: "Create a new password for your account",
};

export default function ResetPasswordPage() {
  return (
    <div>
      <h2 className="mt-6 text-center text-2xl font-bold text-gray-900">
        Create new password
      </h2>
      <p className="mt-2 text-center text-sm text-gray-600">
        Enter your new password below
      </p>
      <ResetPasswordForm />
    </div>
  );
}