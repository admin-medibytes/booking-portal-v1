import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { Metadata } from "next";
import { Users, Mail, Building2, Settings, FileText, BarChart3, ChevronRight } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Admin Dashboard - Medibytes",
  description: "Manage users, organizations, and system settings",
};

export default async function AdminDashboard() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  const user = session.user;
  if (!user.role || !user.role.includes("admin")) {
    redirect("/");
  }

  return (
    <div className="container py-6 mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="mt-2 text-gray-600">Welcome back, {user.name || user.email}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="p-6 bg-white rounded-lg shadow">
          <div className="flex items-center mb-4">
            <Users className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-gray-900">User Management</h3>
          <p className="mb-4 text-gray-600">Create and manage users across the platform</p>
          <Link
            href="/admin/users"
            className="inline-flex items-center font-medium text-blue-600 hover:text-blue-700"
          >
            Manage Users
            <ChevronRight className="w-4 h-4 ml-2" />
          </Link>
        </div>

        <div className="p-6 bg-white rounded-lg shadow">
          <div className="flex items-center mb-4">
            <Mail className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-gray-900">Invitations</h3>
          <p className="mb-4 text-gray-600">Send and manage user invitations</p>
          <Link
            href="/admin/invitations"
            className="inline-flex items-center font-medium text-blue-600 hover:text-blue-700"
          >
            Manage Invitations
            <ChevronRight className="w-4 h-4 ml-2" />
          </Link>
        </div>

        <div className="p-6 bg-white rounded-lg shadow">
          <div className="flex items-center mb-4">
            <Building2 className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-gray-900">Organizations</h3>
          <p className="mb-4 text-gray-600">Manage organizations and teams</p>
          <Link
            href="/admin/organizations"
            className="inline-flex items-center font-medium text-blue-600 hover:text-blue-700"
          >
            Manage Organizations
            <ChevronRight className="w-4 h-4 ml-2" />
          </Link>
        </div>

        <div className="p-6 bg-white rounded-lg shadow">
          <div className="flex items-center mb-4">
            <Settings className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-gray-900">System Settings</h3>
          <p className="mb-4 text-gray-600">Configure system-wide settings</p>
          <Link
            href="/admin/settings"
            className="inline-flex items-center font-medium text-blue-600 hover:text-blue-700"
          >
            System Settings
            <ChevronRight className="w-4 h-4 ml-2" />
          </Link>
        </div>

        <div className="p-6 bg-white rounded-lg shadow">
          <div className="flex items-center mb-4">
            <FileText className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-gray-900">Activity Logs</h3>
          <p className="mb-4 text-gray-600">View system activity and audit logs</p>
          <Link
            href="/admin/logs"
            className="inline-flex items-center font-medium text-blue-600 hover:text-blue-700"
          >
            View Logs
            <ChevronRight className="w-4 h-4 ml-2" />
          </Link>
        </div>

        <div className="p-6 bg-white rounded-lg shadow">
          <div className="flex items-center mb-4">
            <BarChart3 className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-gray-900">Reports</h3>
          <p className="mb-4 text-gray-600">Generate and view system reports</p>
          <Link
            href="/admin/reports"
            className="inline-flex items-center font-medium text-blue-600 hover:text-blue-700"
          >
            View Reports
            <ChevronRight className="w-4 h-4 ml-2" />
          </Link>
        </div>
      </div>
    </div>
  );
}
