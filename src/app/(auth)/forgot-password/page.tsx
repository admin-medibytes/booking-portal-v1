import { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Forgot Password - Medibytes",
  description: "Reset your password",
};

export default function ForgotPasswordPage() {
  return (
   

    <div>
      <h2 className="mt-6 text-center text-2xl font-bold text-gray-900">
        Reset your password
      </h2>
      <p className="mt-2 text-center text-sm text-gray-600">
        Or{" "}
        <Link
          href="/login"
          className="font-medium text-blue-600 hover:text-blue-500"
        >
          sign in to your account
        </Link>
      </p>
      <ForgotPasswordForm />
    </div>
  );
}