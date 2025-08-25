import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { User, Phone, Mail, Calendar, MapPin, Video } from "lucide-react";
import { format } from "date-fns";
import type { BookingWithSpecialist } from "@/types/booking";

interface BookingDetailCardProps {
  booking: BookingWithSpecialist;
}

export function BookingDetailCard({ booking }: BookingDetailCardProps) {
  const getStatusColor = (status: string) => {
    const colors = {
      active: "default",
      closed: "secondary",
      archived: "outline",
    } as const;
    return colors[status as keyof typeof colors] || "secondary";
  };

  const formatStatus = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <div className="space-y-6">
      {/* Status Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Booking Status</CardTitle>
            <Badge variant={getStatusColor(booking.status)} className="text-sm">
              {formatStatus(booking.status)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-500">
            Last updated: {format(new Date(booking.updatedAt), "MMM dd, yyyy h:mm a")}
          </div>
        </CardContent>
      </Card>

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
              <p className="text-sm font-medium text-gray-500">Date of Birth</p>
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
              <p className="text-sm font-medium text-gray-500">Examination Type</p>
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
              <p className="text-sm font-medium text-gray-500">Scheduled Date</p>
              <p className="text-lg">
                {booking.examDate
                  ? format(new Date(booking.examDate), "MMM dd, yyyy h:mm a")
                  : "Not scheduled"}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Specialist</p>
              <p className="text-lg">{booking.specialist?.name || "Not assigned"}</p>
              {booking.specialist.jobTitle && (
                <p className="text-sm text-gray-500">{booking.specialist.jobTitle}</p>
              )}
            </div>
          </div>

          {booking.notes && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium text-gray-500 mb-2">Notes</p>
                <p className="text-gray-700 whitespace-pre-wrap">{booking.notes}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
