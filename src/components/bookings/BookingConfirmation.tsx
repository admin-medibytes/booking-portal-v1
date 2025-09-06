"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  User,
  Calendar,
  Clock,
  Phone,
  Mail,
  FileText,
  MapPin,
  Video,
  AlertCircle,
  MapPinned,
} from "lucide-react";
import { bookingsClient } from "@/lib/hono-client";
import { ApiError } from "@/lib/hono-utils";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatLocationFull, getLocationDisplay } from "@/lib/utils/location";
import type { Specialist } from "@/types/specialist";

interface BookingConfirmationProps {
  specialist: Specialist;
  appointmentType: {
    id: string;
    acuityAppointmentTypeId: number;
    name: string;
    duration: number;
    description: string | null;
    category: string | null;
    appointmentMode?: "in-person" | "telehealth";
    source: {
      name: "acuity" | "override";
      description: "acuity" | "override";
    };
  };
  dateTime: Date;
  intakeFormData: {
    // Referrer Information
    referrerFirstName: string;
    referrerLastName: string;
    referrerEmail: string;
    referrerPhone: string;
    // Examinee Information
    examineeFirstName: string;
    examineeLastName: string;
    examineeDateOfBirth: string;
    examineePhone: string;
    examineeEmail?: string | null;
    examineeAddress: string;
    // Medical & Case Information
    conditions: string;
    caseType: string;
    contactAuthorisation: boolean;
    termsAccepted: boolean;
    specialNotes?: string | null;
  };
  onConfirm: (bookingId: string) => void;
  bookingId: string | null;
}

export function BookingConfirmation({
  specialist,
  appointmentType,
  dateTime,
  intakeFormData,
  onConfirm,
  bookingId,
}: BookingConfirmationProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const createBookingMutation = useMutation({
    mutationFn: async () => {
      const response = await bookingsClient.$post({
        json: {
          specialistId: specialist.id,
          appointmentTypeId: appointmentType.id,
          appointmentType: appointmentType.appointmentMode || "telehealth",
          appointmentDateTime: dateTime.toISOString(),
          examineeName: `${intakeFormData.examineeFirstName} ${intakeFormData.examineeLastName}`,
          examineePhone: intakeFormData.examineePhone,
          examineeEmail: intakeFormData.examineeEmail,
          notes:
            `REFERRER: ${intakeFormData.referrerFirstName} ${intakeFormData.referrerLastName} | ${intakeFormData.referrerEmail} | ${intakeFormData.referrerPhone}\n` +
            `EXAMINEE: ${intakeFormData.examineeFirstName} ${intakeFormData.examineeLastName}\n` +
            `DOB: ${intakeFormData.examineeDateOfBirth}\n` +
            `Phone: ${intakeFormData.examineePhone}\n` +
            `Email: ${intakeFormData.examineeEmail || "Not provided"}\n` +
            `Address: ${intakeFormData.examineeAddress}\n` +
            `Conditions: ${intakeFormData.conditions}\n` +
            `Case Type: ${intakeFormData.caseType}\n` +
            `Contact Auth: ${intakeFormData.contactAuthorisation ? "Yes" : "No"}\n` +
            `Terms Accepted: ${intakeFormData.termsAccepted ? "Yes" : "No"}\n` +
            (intakeFormData.specialNotes ? `Special Notes: ${intakeFormData.specialNotes}` : ""),
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new ApiError(error || "Failed to create booking", response.status);
      }

      return (await response.json()) as { success: boolean; id: string; message: string };
    },
    onSuccess: (data) => {
      onConfirm(data.id);
      toast.success("Booking created successfully!");
    },
    onError: (err: Error) => {
      const message = err.message || "Failed to create booking. Please try again.";
      setError(message);
      toast.error(message);
    },
  });

  const handleConfirm = () => {
    setError(null);
    createBookingMutation.mutate();
  };

  const handleViewBooking = () => {
    if (bookingId) {
      router.push(`/bookings/${bookingId}`);
    }
  };

  const handleCreateAnother = () => {
    router.push("/bookings/new");
  };

  if (bookingId) {
    return (
      <Card className="border-green-200 bg-green-50/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-6 w-6 text-green-600" />
            <CardTitle>Booking Confirmed!</CardTitle>
          </div>
          <CardDescription>
            Your booking has been successfully created and confirmed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              A confirmation has been sent to the referrer and the specialist has been notified. The
              examinee will receive appointment details closer to the examination date.
            </AlertDescription>
          </Alert>

          <div className="flex gap-2">
            <Button onClick={handleViewBooking} className="flex-1">
              View Booking Details
            </Button>
            <Button onClick={handleCreateAnother} variant="outline" className="flex-1">
              Create Another Booking
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Review Booking Details</CardTitle>
          <CardDescription>
            Please review all information before confirming the booking
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Specialist Information */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <User className="h-4 w-4" />
              Specialist Information
            </h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Name:</span>{" "}
                <span className="font-medium">{specialist.name}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Specialty:</span>{" "}
                <span className="font-medium">{specialist.user?.jobTitle || "Specialist"}</span>
              </div>
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Location:</span>{" "}
                <span className="font-medium">
                  {getLocationDisplay(
                    specialist.acceptsInPerson || false,
                    specialist.acceptsTelehealth || true,
                    specialist.location ?? null
                  )}
                </span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Appointment Details */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Appointment Details
            </h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Type:</span>{" "}
                <span className="font-medium">{appointmentType.name}</span>
                {appointmentType.category && (
                  <Badge variant="outline" className="ml-2">
                    {appointmentType.category}
                  </Badge>
                )}
              </div>
              <div>
                <span className="text-muted-foreground">Duration:</span>{" "}
                <span className="font-medium">{appointmentType.duration} minutes</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Date & Time:</span>{" "}
                <span className="font-medium">
                  {format(dateTime, "EEEE, MMMM d, yyyy 'at' h:mm a")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {appointmentType.appointmentMode === "telehealth" ? (
                  <>
                    <Video className="h-3 w-3 text-blue-600" />
                    <Badge variant="secondary" className="text-blue-600">
                      Telehealth Appointment
                    </Badge>
                  </>
                ) : (
                  <>
                    <MapPin className="h-3 w-3 text-muted-foreground" />
                    <Badge variant="secondary">In-Person Appointment</Badge>
                  </>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Referrer Information */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <User className="h-4 w-4" />
              Referrer Information
            </h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Name:</span>{" "}
                <span className="font-medium">
                  {intakeFormData.referrerFirstName} {intakeFormData.referrerLastName}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Mail className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Email:</span>{" "}
                <span className="font-medium">{intakeFormData.referrerEmail}</span>
              </div>
              <div className="flex items-center gap-1">
                <Phone className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Phone:</span>{" "}
                <span className="font-medium">{intakeFormData.referrerPhone}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Examinee Information */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <User className="h-4 w-4" />
              Examinee Information
            </h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Name:</span>{" "}
                <span className="font-medium">
                  {intakeFormData.examineeFirstName} {intakeFormData.examineeLastName}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Date of Birth:</span>{" "}
                <span className="font-medium">{intakeFormData.examineeDateOfBirth}</span>
              </div>
              <div className="flex items-center gap-1">
                <Phone className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Phone:</span>{" "}
                <span className="font-medium">{intakeFormData.examineePhone}</span>
              </div>
              {intakeFormData.examineeEmail && (
                <div className="flex items-center gap-1">
                  <Mail className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Email:</span>{" "}
                  <span className="font-medium">{intakeFormData.examineeEmail}</span>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Address:</span>{" "}
                <span className="font-medium whitespace-pre-line">
                  {intakeFormData.examineeAddress}
                </span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Medical & Case Information */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Medical & Case Information
            </h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Medical Conditions:</span>{" "}
                <span className="font-medium">{intakeFormData.conditions}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Case Type:</span>{" "}
                <span className="font-medium">{intakeFormData.caseType}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Consents:</span>{" "}
                <span className="font-medium text-green-600">
                  {intakeFormData.contactAuthorisation && intakeFormData.termsAccepted
                    ? "✓ All obtained"
                    : "Incomplete"}
                </span>
              </div>
              {intakeFormData.specialNotes && (
                <div className="mt-3">
                  <div className="flex items-center gap-1 mb-1">
                    <FileText className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Special Notes:</span>
                  </div>
                  <p className="text-sm bg-muted p-2 rounded-md">{intakeFormData.specialNotes}</p>
                </div>
              )}
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button
          onClick={handleConfirm}
          disabled={createBookingMutation.isPending}
          className="flex-1"
        >
          {createBookingMutation.isPending ? "Creating Booking..." : "Confirm Booking"}
        </Button>
        <Button
          variant="outline"
          onClick={() => router.push("/bookings")}
          disabled={createBookingMutation.isPending}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
