"use client";

import { useParams, useRouter } from "next/navigation";
import { useBooking } from "@/hooks/use-bookings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Calendar,
  Clock,
  FileText,
  MapPin,
  Phone,
  User,
  Video,
  Loader2,
  Mail,
} from "lucide-react";
import { format } from "date-fns";

export default function BookingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const bookingId = params.id as string;

  const { data: booking, isLoading, error } = useBooking(bookingId);

  if (isLoading) {
    return (
      <div className="container py-6 mx-auto">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="container py-6 mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">
            {error?.message || "Booking not found"}
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.push("/bookings")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Bookings
          </Button>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    const colors = {
      active: "default",
      closed: "secondary",
      archived: "outline",
    } as const;
    return colors[status as keyof typeof colors] || "secondary";
  };

  return (
    <div className="container py-6 mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/bookings")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Booking Details
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              ID: {booking.id}
            </p>
          </div>
        </div>
        <Badge variant={getStatusColor(booking.status)} className="text-sm">
          {booking.status.replace("_", " ").charAt(0).toUpperCase() + 
           booking.status.slice(1).replace("_", " ")}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Patient Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Patient Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-gray-500">Name</p>
                  <p className="text-lg">
                    {booking.patientFirstName} {booking.patientLastName}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Phone</p>
                  <p className="text-lg flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    {booking.patientPhone}
                  </p>
                </div>
                {booking.patientEmail && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Email</p>
                    <p className="text-lg flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      {booking.patientEmail}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-gray-500">
                    Date of Birth
                  </p>
                  <p className="text-lg">
                    {format(new Date(booking.patientDateOfBirth), "MMM dd, yyyy")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Appointment Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Appointment Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-gray-500">
                    Examination Type
                  </p>
                  <p className="text-lg">{booking.examinationType}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Location</p>
                  <p className="text-lg flex items-center gap-2">
                    {booking.examLocation === "telehealth" ? (
                      <>
                        <Video className="w-4 h-4 text-blue-600" />
                        Telehealth
                      </>
                    ) : (
                      <>
                        <MapPin className="w-4 h-4" />
                        {booking.examLocation}
                      </>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">
                    Scheduled Date
                  </p>
                  <p className="text-lg">
                    {booking.examDate
                      ? format(new Date(booking.examDate), "MMM dd, yyyy h:mm a")
                      : "Not scheduled"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">
                    Specialist
                  </p>
                  <p className="text-lg">{booking.specialist?.name || 'Not assigned'}</p>
                  <p className="text-sm text-gray-500">
                    {booking.specialist?.specialty || 'N/A'}
                  </p>
                </div>
              </div>

              {booking.notes && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-2">
                      Notes
                    </p>
                    <p className="text-gray-700 whitespace-pre-wrap">
                      {booking.notes}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Documents */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500">
                Document management will be available in a future update.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full" variant="outline">
                Edit Booking
              </Button>
              <Button className="w-full" variant="outline">
                Reschedule
              </Button>
              <Button className="w-full" variant="outline" disabled>
                Generate Report
              </Button>
              <Button className="w-full" variant="destructive">
                Cancel Booking
              </Button>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-500 mt-2" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Booking Created</p>
                    <p className="text-xs text-gray-500">
                      {format(new Date(booking.createdAt), "MMM dd, yyyy h:mm a")}
                    </p>
                  </div>
                </div>
                {booking.scheduledAt && (
                  <div className="flex gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-2" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Scheduled</p>
                      <p className="text-xs text-gray-500">
                        {format(
                          new Date(booking.scheduledAt),
                          "MMM dd, yyyy h:mm a"
                        )}
                      </p>
                    </div>
                  </div>
                )}
                {booking.completedAt && (
                  <div className="flex gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500 mt-2" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Completed</p>
                      <p className="text-xs text-gray-500">
                        {format(
                          new Date(booking.completedAt),
                          "MMM dd, yyyy h:mm a"
                        )}
                      </p>
                    </div>
                  </div>
                )}
                {booking.cancelledAt && (
                  <div className="flex gap-3">
                    <div className="w-2 h-2 rounded-full bg-red-500 mt-2" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Cancelled</p>
                      <p className="text-xs text-gray-500">
                        {format(
                          new Date(booking.cancelledAt),
                          "MMM dd, yyyy h:mm a"
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}