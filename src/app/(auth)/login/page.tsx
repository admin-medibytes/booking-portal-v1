import { LoginForm } from "@/components/auth/login-form";
import { Metadata } from "next";
import { TriangleAlertIcon } from "lucide-react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";


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
      <Alert variant="warning" className="mt-4">
        <TriangleAlertIcon />
        <AlertTitle>Having trouble logging in?</AlertTitle>
        <AlertDescription className="text-xs">
        We&apos;ve recently updated our portal.<br />
        Please check your email (including spam) for your new login details.<br />
        You can also select &quot;Forgot Password&quot; above to reset your password.<br />
        Still stuck? Call us on 1800 603 920.
        </AlertDescription>
      </Alert>
    </div>
  );
}