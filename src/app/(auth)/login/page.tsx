import { LoginForm } from "@/components/auth/login-form";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In - Medibytes Booking Portal",
  description: "Sign in to access your bookings and manage appointments",
};

export default function LoginPage() {
  return (
    <div>
      <h2 className="mt-6 text-center text-2xl font-bold text-gray-900">
        Sign in to your account
      </h2>
      <p className="mt-2 text-center text-sm text-gray-600">
        Enter your credentials to access the booking portal
      </p>
      <LoginForm />
    </div>
  );
}