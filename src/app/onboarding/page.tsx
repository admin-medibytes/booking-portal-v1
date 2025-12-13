import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { OnboardingForm } from "@/components/auth/onboarding-form";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Complete Your Profile - Medibytes",
  description: "Set up your password and security preferences",
};

export default async function OnboardingPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  const user = session.user;
  if (user.image) {
    redirect("/");
  }

  return (
    <div className="flex flex-col justify-center min-h-screen py-12 bg-gray-50 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h1 className="text-3xl font-bold text-center text-gray-900">Password Setup</h1>
        <p className="mt-2 text-sm text-center text-gray-600">
          Complete your profile setup to get started
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="px-4 py-8 bg-white shadow sm:rounded-lg sm:px-10">
          <OnboardingForm allow2fa={user.role === "admin"} />
        </div>
      </div>
    </div>
  );
}
