import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session?.user) {
    redirect("/");
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Medibytes Legal</h1>
          <p className="mt-2 text-sm text-gray-600">Booking Portal</p>
        </div>
        {children}
      </div>
    </div>
  );
}