import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/server/db";
import { members } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { Metadata } from "next";
import { Calendar, Clock, FileText, Plus, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Bookings - Medibytes",
  description: "Manage your patient bookings and appointments",
};

export default async function BookingsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  // Check if user is a referrer
  const userMemberships = await db
    .select()
    .from(members)
    .where(eq(members.userId, session.user.id));

  const isReferrer = userMemberships.some((m) =>
    ["owner", "manager", "team_lead", "referrer"].includes(m.role)
  );
  if (!isReferrer && !session.user.role?.includes("admin")) {
    redirect("/");
  }

  return (
    <div className="container py-6 mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Bookings</h1>
          <p className="mt-2 text-gray-600">Manage patient appointments and referrals</p>
        </div>
        <Button className="inline-flex items-center">
          <Plus className="w-4 h-4 mr-2" />
          New Booking
        </Button>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute w-4 h-4 text-gray-400 -translate-y-1/2 left-3 top-1/2" />
          <input
            type="text"
            placeholder="Search bookings..."
            className="w-full py-2 pl-10 pr-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <Button variant="outline" className="inline-flex items-center">
          <Filter className="w-4 h-4 mr-2" />
          Filter
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 mb-8 md:grid-cols-3">
        <div className="p-6 bg-white rounded-lg shadow">
          <div className="flex items-center justify-between mb-4">
            <Calendar className="w-8 h-8 text-blue-600" />
            <span className="text-2xl font-bold text-gray-900">0</span>
          </div>
          <h3 className="text-sm font-medium text-gray-600">Today&apos;s Bookings</h3>
        </div>

        <div className="p-6 bg-white rounded-lg shadow">
          <div className="flex items-center justify-between mb-4">
            <Clock className="w-8 h-8 text-green-600" />
            <span className="text-2xl font-bold text-gray-900">0</span>
          </div>
          <h3 className="text-sm font-medium text-gray-600">Pending Approvals</h3>
        </div>

        <div className="p-6 bg-white rounded-lg shadow">
          <div className="flex items-center justify-between mb-4">
            <FileText className="w-8 h-8 text-purple-600" />
            <span className="text-2xl font-bold text-gray-900">0</span>
          </div>
          <h3 className="text-sm font-medium text-gray-600">Total This Month</h3>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent Bookings</h2>
        </div>
        <div className="p-6">
          <div className="py-12 text-center">
            <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h3 className="mb-2 text-lg font-medium text-gray-900">No bookings yet</h3>
            <p className="mb-6 text-gray-600">Create your first booking to get started</p>
            <Button className="inline-flex items-center">
              <Plus className="w-4 h-4 mr-2" />
              Create Booking
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
