"use client";

import { Fragment, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";
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
} from "lucide-react";
import { bookingsClient } from "@/lib/hono-client";
import { ApiError } from "@/lib/hono-utils";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { getLocationDisplay } from "@/lib/utils/location";
import type { Specialist } from "@/types/specialist";

interface IntakeFormData {
  referrerInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  fieldsInfo: Array<{
    id: number;
    value: string;
  }>;
  termsAccepted: boolean;
}

// Minimal shape of the form configuration used for rendering confirmation
interface AppointmentFormConfiguration {
  id: string;
  name: string;
  description?: string | null;
  fields: Array<{
    acuityFieldId: number;
    customLabel?: string | null;
    isHidden: boolean;
    acuityField?: {
      id: number;
      name: string;
      type: string;
      required: boolean;
      options?: string[] | null;
    };
  }>;
  acuityForm?: {
    id: number;
    name: string;
    description: string | null;
  } | null;
}

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
  };
  dateTime: Date;
  datetimeString: string;
  timezone: string;
  organizationSlug: string;
  intakeFormFields: IntakeFormData;
  formConfiguration?: AppointmentFormConfiguration;
  onBack: () => void;
  onConfirm: (bookingId: string) => void;
  bookingId: string | null;
}

// Helper function to format form data for display
function formatFormDataForDisplay(
  data: IntakeFormData,
  formConfig?: AppointmentFormConfiguration
): Array<{ label: string; value: string; section?: string }> {
  const formatted: Array<{ label: string; value: string; section?: string }> = [];

  // Add referrer information
  formatted.push(
    { label: "First Name", value: data.referrerInfo.firstName, section: "Referrer Information" },
    { label: "Last Name", value: data.referrerInfo.lastName, section: "Referrer Information" },
    { label: "Email", value: data.referrerInfo.email, section: "Referrer Information" },
    { label: "Phone", value: data.referrerInfo.phone, section: "Referrer Information" }
  );

  // Get the form name for the section title
  const formSectionName = formConfig?.name || "Intake Form";

  // Create a map for field labels from the form configuration
  const fieldLabelMap: Record<number, string> = {};
  const hiddenFieldsSet = new Set<number>();

  if (formConfig && formConfig.fields) {
    formConfig.fields.forEach((field: AppointmentFormConfiguration["fields"][number]) => {
      const fieldId = field.acuityFieldId;
      // Use customLabel if available, otherwise use the acuity field name
      const label = field.customLabel || field.acuityField?.name || `Field ${fieldId}`;
      fieldLabelMap[fieldId] = label;

      // Track hidden fields
      if (field.isHidden) {
        hiddenFieldsSet.add(fieldId);
      }
    });
  }

  // Add dynamic form fields with the form's name as the section
  data.fieldsInfo.forEach((field) => {
    // Skip hidden fields
    if (hiddenFieldsSet.has(field.id)) return;

    // Skip empty values
    if (field.value === null || field.value === undefined || field.value === "") return;

    const label = fieldLabelMap[field.id] || `Field ${field.id}`;
    formatted.push({ label, value: field.value, section: formSectionName });
  });

  return formatted;
}

export function BookingConfirmation({
  specialist,
  appointmentType,
  dateTime,
  datetimeString,
  timezone,
  organizationSlug,
  intakeFormFields,
  formConfiguration,
  onConfirm,
  onBack,
  bookingId,
}: BookingConfirmationProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { user: _user } = useAuth();

  const createBookingMutation = useMutation({
    mutationFn: async () => {
      if (!organizationSlug) {
        throw new Error("Organization not selected. Please go back and select an organization.");
      }

      // Prepare the booking data matching the new API structure
      // Use the original datetime string from Acuity to avoid format conversion issues
      const bookingData = {
        appointmentTypeId: appointmentType.acuityAppointmentTypeId,
        datetime: datetimeString,
        firstName: intakeFormFields.referrerInfo.firstName,
        lastName: intakeFormFields.referrerInfo.lastName,
        email: intakeFormFields.referrerInfo.email,
        phone: intakeFormFields.referrerInfo.phone,
        timezone: timezone,
        organizationSlug: organizationSlug,
        specialistId: specialist.id,
        fields: intakeFormFields.fieldsInfo,
      };

      const response = await bookingsClient.$post({
        json: bookingData,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new ApiError(error || "Failed to create booking", response.status);
      }

      return await response.json();
    },
    onSuccess: (data) => {
      onConfirm(data.id);
      toast.success("Booking created successfully!");
      // Redirect to the booking detail page
      router.push(`/bookings/${data.id}`);
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
                  {intakeFormFields.referrerInfo.firstName} {intakeFormFields.referrerInfo.lastName}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Mail className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Email:</span>{" "}
                <span className="font-medium">{intakeFormFields.referrerInfo.email}</span>
              </div>
              <div className="flex items-center gap-1">
                <Phone className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Phone:</span>{" "}
                <span className="font-medium">{intakeFormFields.referrerInfo.phone}</span>
              </div>
            </div>
          </div>

          {/* Dynamic Form Fields */}
          {(() => {
            const formattedFields = formatFormDataForDisplay(intakeFormFields, formConfiguration);
            const sections = formattedFields.reduce(
              (acc, field) => {
                const section = field.section || "Other Information";
                if (!acc[section]) acc[section] = [];
                if (section !== "Referrer Information") {
                  // Skip referrer fields as they're shown above
                  acc[section].push(field);
                }
                return acc;
              },
              {} as Record<string, Array<{ label: string; value: string }>>
            );

            return Object.entries(sections).map(([sectionName, fields]) => {
              if (fields.length === 0) return null;
              return (
                <Fragment key={sectionName}>
                  <Separator />
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      {sectionName}
                    </h3>
                    <div className="space-y-2 text-sm">
                      {fields.map((field, index) => (
                        <div key={index}>
                          <span className="text-muted-foreground">{field.label}:</span>{" "}
                          <span className="font-medium">{field.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Fragment>
              );
            });
          })()}

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
          variant="outline"
          onClick={onBack}
          disabled={createBookingMutation.isPending}
        >
          Back
        </Button>
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

      {/* Loading Dialog */}
      <AlertDialog open={createBookingMutation.isPending}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Creating Booking
            </AlertDialogTitle>
            <AlertDialogDescription>
              Please wait while we process your booking request. This may take a few moments.
            </AlertDialogDescription>
          </AlertDialogHeader>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
