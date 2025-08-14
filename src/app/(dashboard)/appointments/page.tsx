import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/server/db";
import { members } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { Metadata } from "next";
import { Calendar, Clock, Users, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Appointments - Medibytes",
  description: "View and manage your patient appointments",
};

export default async function AppointmentsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  // Check if user is a specialist
  const userMemberships = await db
    .select()
    .from(members)
    .where(eq(members.userId, session.user.id));

  const isSpecialist = userMemberships.some((m) => m.role === "specialist");
  if (!isSpecialist && !session.user.role?.includes("admin")) {
    redirect("/");
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Appointments</h1>
        <p className="mt-2 text-gray-600">View and manage your scheduled appointments</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <Calendar className="h-8 w-8 text-blue-600" />
            <span className="text-2xl font-bold text-gray-900">0</span>
          </div>
          <h3 className="text-sm font-medium text-gray-600">Today&apos;s Appointments</h3>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <Clock className="h-8 w-8 text-yellow-600" />
            <span className="text-2xl font-bold text-gray-900">0</span>
          </div>
          <h3 className="text-sm font-medium text-gray-600">Pending Review</h3>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <span className="text-2xl font-bold text-gray-900">0</span>
          </div>
          <h3 className="text-sm font-medium text-gray-600">Completed</h3>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <Users className="h-8 w-8 text-purple-600" />
            <span className="text-2xl font-bold text-gray-900">0</span>
          </div>
          <h3 className="text-sm font-medium text-gray-600">Total Patients</h3>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Upcoming Appointments</h2>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-4">
                <AlertCircle className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium text-gray-900">No upcoming appointments</p>
                  <p className="text-sm text-gray-600">Your schedule is clear for today</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">Appointment History</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              Export
            </Button>
          </div>
        </div>
        <div className="p-6">
          <div className="text-center py-12">
            <Calendar className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No appointments yet</h3>
            <p className="text-gray-600">Your appointment history will appear here</p>
          </div>
        </div>
      </div>
    </div>
  );
}