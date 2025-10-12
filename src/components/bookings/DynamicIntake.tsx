"use client";

import { useState, useRef, useImperativeHandle, forwardRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import { type } from "arktype";
import { specialistsClient } from "@/lib/hono-client";
import { AppFormRenderer } from "@/components/forms/AppFormRenderer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneNumberInput } from "@/components/ui/phone-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileText,
  AlertCircle,
  UserCheck,
  Calendar,
  Clock,
  MapPin,
  Video,
  Globe,
  Shield,
  Info,
} from "lucide-react";
import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Specialist } from "@/types/specialist";
import { getInitials } from "@/lib/utils/initials";
import { Separator } from "../ui/separator";

// Minimal shape of the form configuration used for rendering
interface AppointmentFormConfiguration {
  id: string;
  name: string;
  description?: string | null;
  fields: Array<{
    acuityFieldId: number;
    customLabel?: string | null;
    isHidden: boolean;
    displayWidth?: "full" | "half" | "third";
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

interface AppointmentType {
  id: string;
  acuityAppointmentTypeId: number;
  name: string;
  duration: number;
  description: string | null;
  category: string | null;
  appointmentMode?: "in-person" | "telehealth";
}

// Referrer form schema
const referrerFormSchema = type({
  referrerFirstName: "string>0",
  referrerLastName: "string>0",
  referrerEmail: "string.email",
  referrerPhone: "string>0",
});

interface SubmitData {
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

interface DynamicIntakeProps {
  specialist: Specialist;
  appointmentType: AppointmentType;
  dateTime: Date;
  datetimeString?: string; // Original datetime string from Acuity
  timezone: string;
  onSubmit: (data: SubmitData) => void;
  onValidationChange?: (isValid: boolean) => void;
  onFormConfigurationLoaded?: (config: AppointmentFormConfiguration) => void;
  defaultValues?: {
    referrerInfo?: {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
    };
    referrerFirstName?: string;
    referrerLastName?: string;
    referrerEmail?: string;
    referrerPhone?: string;
    fieldsInfo?: Array<{ id: number; value: string }>;
  };
  renderMode?: "full" | "summary" | "forms";
  hideSubmitButton?: boolean;
}

export interface DynamicIntakeRef {
  submit: () => void;
}

// Helper function to extract only dynamic form field values (excluding referrer fields)
function extractDynamicFormValues(
  allValues?: Record<string, string> | { fieldsInfo?: Array<{ id: number; value: string }> }
): Record<string, string> | undefined {
  if (!allValues) return undefined;

  const dynamicValues: Record<string, string> = {};

  // Handle new format (fieldsInfo array)
  if (allValues.fieldsInfo && Array.isArray(allValues.fieldsInfo)) {
    // Convert fieldsInfo array back to field_id format for the form
    allValues.fieldsInfo.forEach((field: { id: number; value: string }) => {
      dynamicValues[`field_${field.id}`] = field.value;
    });
  } else {
    // Handle old format with field_ prefix
    Object.entries(allValues as Record<string, string>).forEach(([key, value]) => {
      if (key.startsWith("field_")) {
        dynamicValues[key] = value;
      }
    });
  }

  return Object.keys(dynamicValues).length > 0 ? dynamicValues : undefined;
}

export const DynamicIntake = forwardRef<DynamicIntakeRef, DynamicIntakeProps>(
  (
    {
      specialist,
      appointmentType,
      dateTime,
      datetimeString: _datetimeString,
      timezone,
      onSubmit,
      onValidationChange,
      onFormConfigurationLoaded,
      defaultValues,
      renderMode = "full",
      hideSubmitButton = false,
    },
    ref
  ) => {
    const [showTermsModal, setShowTermsModal] = useState(false);
    const [modalTermsAccepted, setModalTermsAccepted] = useState(false);
    const [pendingSubmitData, setPendingSubmitData] = useState<SubmitData | null>(null);
    // Check if dynamic form has no required fields (all optional), then it's valid by default
    const [isDynamicFormValid, setIsDynamicFormValid] = useState(false);
    const appFormRef = useRef<{ submit: () => void } | null>(null);

    // Initialize referrer form
    const referrerForm = useForm({
      defaultValues: {
        referrerFirstName:
          defaultValues?.referrerInfo?.firstName || defaultValues?.referrerFirstName || "",
        referrerLastName:
          defaultValues?.referrerInfo?.lastName || defaultValues?.referrerLastName || "",
        referrerEmail: defaultValues?.referrerInfo?.email || defaultValues?.referrerEmail || "",
        referrerPhone: defaultValues?.referrerInfo?.phone || defaultValues?.referrerPhone || "",
      },
      onSubmit: async ({ value }) => {
        // This will be called when the entire form is submitted
        return value;
      },
    });

    // Fetch the form configuration for this appointment type
    const {
      data: formData,
      isLoading,
      error,
    } = useQuery({
      queryKey: ["appointment-type-form", specialist.id, appointmentType.acuityAppointmentTypeId],
      queryFn: async () => {
        const response = await specialistsClient[":id"]["appointment-types"][":typeId"].form.$get({
          param: {
            id: specialist.id,
            typeId: appointmentType.acuityAppointmentTypeId.toString(),
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch form configuration");
        }

        const result = await response.json();
        return result.data as AppointmentFormConfiguration | null;
      },
      retry: 1,
    });

    // Pass form configuration to parent when loaded
    useEffect(() => {
      if (formData && onFormConfigurationLoaded) {
        onFormConfigurationLoaded(formData);
      }
    }, [formData, onFormConfigurationLoaded]);

    // Handle dynamic form validation callback
    const handleDynamicFormValidationChange = (isValid: boolean) => {
      console.log("Dynamic form validation changed:", isValid);
      setIsDynamicFormValid(isValid);
    };

    // Subscribe to form state changes using TanStack Form's subscribe method
    useEffect(() => {
      if (!onValidationChange) return;

      // Function to check and update validation
      const checkValidation = () => {
        // Check both referrer form validation and dynamic form validation
        if (formData) {
          const referrerData = referrerForm.state.values;
          console.log("Referrer form data:", referrerData);
          const isReferrerValid = referrerFormSchema(referrerData);
          const isReferrerFormValid = !(isReferrerValid instanceof type.errors);

          if (isReferrerValid instanceof type.errors) {
            console.log("Referrer validation errors:", isReferrerValid.summary);
          }

          // Combined validation: both referrer form and dynamic form must be valid
          const isCombinedValid = isReferrerFormValid && isDynamicFormValid;
          console.log(
            "Validation check - Referrer valid:",
            isReferrerFormValid,
            "Dynamic valid:",
            isDynamicFormValid,
            "Combined:",
            isCombinedValid
          );
          onValidationChange(isCombinedValid);
        }
      };

      // Check validation immediately
      checkValidation();

      // Subscribe to form changes
      const unsubscribe = referrerForm.store.subscribe(() => {
        checkValidation();
      });

      return () => unsubscribe();
    }, [
      referrerForm.store,
      referrerForm.state.values,
      isDynamicFormValid,
      formData,
      onValidationChange,
    ]);

    // Expose submit method via ref
    useImperativeHandle(ref, () => ({
      submit: () => {
        // Trigger dynamic form submission
        if (appFormRef.current) {
          appFormRef.current.submit();
        }
      },
    }));

    const handleDynamicFormSubmit = async (data: Record<string, string | number | boolean | string[] | null | undefined>) => {
      // Validate referrer form first
      const referrerData = referrerForm.state.values;
      const isReferrerValid = referrerFormSchema(referrerData);

      if (isReferrerValid instanceof type.errors) {
        // Trigger validation on all referrer fields
        await referrerForm.handleSubmit();
        return;
      }

      // Transform dynamic form data to fieldsInfo array format
      // The AppFormRenderer uses field_{id} format, so we extract the numeric ID
      const fieldsInfo: Array<{ id: number; value: string }> = [];
      Object.entries(data).forEach(([key, value]) => {
        if (key.startsWith("field_")) {
          const fieldId = parseInt(key.replace("field_", ""), 10);
          if (!isNaN(fieldId)) {
            fieldsInfo.push({
              id: fieldId,
              value: String(value),
            });
          }
        }
      });

      // Structure the data according to the new format
      const structuredData: SubmitData = {
        referrerInfo: {
          firstName: referrerData.referrerFirstName,
          lastName: referrerData.referrerLastName,
          email: referrerData.referrerEmail,
          phone: referrerData.referrerPhone,
        },
        fieldsInfo,
        termsAccepted: false,
      };

      // Always show terms modal for confirmation
      setPendingSubmitData(structuredData);
      setShowTermsModal(true);
    };

    const handleTermsAccept = () => {
      if (!pendingSubmitData) return;

      onSubmit({ ...pendingSubmitData, termsAccepted: true });
    };

    // Terms and Conditions Modal
    const TermsModal = () => (
      <Dialog open={showTermsModal} onOpenChange={setShowTermsModal}>
        <DialogContent
          className="max-w-2xl max-h-[80vh]"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-amber-600" />
              Terms and Conditions
            </DialogTitle>
            <DialogDescription>
              Please read and accept our terms and conditions to proceed with your booking.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              <div className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="font-medium text-foreground">
                    By proceeding with this booking, you acknowledge and agree to the following
                    terms:
                  </p>
                </div>

                <ul className="space-y-3 ml-6">
                  <li className="flex items-start gap-2">
                    <span className="text-amber-600 font-bold">•</span>
                    <span>
                      The examination will be conducted in accordance with professional medical
                      standards and ethics.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-600 font-bold">•</span>
                    <span>
                      A comprehensive report will be provided within 10 business days of the
                      examination.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-600 font-bold">•</span>
                    <span>
                      Cancellations must be made at least 48 hours in advance to avoid cancellation
                      fees.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-600 font-bold">•</span>
                    <span>Payment is due within 14 days of the report being issued.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-600 font-bold">•</span>
                    <span>
                      All personal and medical information will be handled in strict confidence in
                      accordance with privacy laws.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-600 font-bold">•</span>
                    <span>
                      The specialist maintains independence and objectivity in all assessments.
                    </span>
                  </li>
                </ul>
              </div>

              <Separator className="my-4" />

              <Alert className="border-amber-300 bg-amber-100">
                <AlertCircle className="h-4 w-4 text-amber-700" />
                <AlertDescription className="text-sm text-amber-900">
                  <strong>Important:</strong> Failure to attend the appointment without proper
                  notice may result in charges as per our cancellation policy. By accepting these
                  terms, you confirm that all information provided is accurate and complete.
                </AlertDescription>
              </Alert>

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <h4 className="font-semibold text-sm mb-2">Privacy & Data Protection</h4>
                <p className="text-sm text-muted-foreground">
                  Your personal information will be processed in accordance with applicable privacy
                  laws. We implement appropriate technical and organizational measures to protect
                  your data against unauthorized access, alteration, disclosure, or destruction.
                </p>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <h4 className="font-semibold text-sm mb-2">Cancellation Policy</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• More than 48 hours notice: No charge</li>
                  <li>• 24-48 hours notice: 50% of consultation fee</li>
                  <li>• Less than 24 hours notice: 100% of consultation fee</li>
                </ul>
              </div>
            </div>
          </ScrollArea>

          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="accept-terms"
                checked={modalTermsAccepted}
                onCheckedChange={(checked) => setModalTermsAccepted(checked as boolean)}
              />
              <Label
                htmlFor="accept-terms"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 select-none cursor-pointer"
              >
                I have read and accept the terms and conditions
              </Label>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowTermsModal(false);
                  setModalTermsAccepted(false);
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleTermsAccept} disabled={!modalTermsAccepted}>
                Accept & Continue
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    );

    // Render booking summary card
    const BookingSummaryCard = () => (
      <Card className="overflow-hidden py-0">
        <div className="bg-gradient-to-r from-primary/20 to-primary/5 p-6">
          <div className="flex items-center gap-4 mb-6">
            <Avatar className="w-16 h-16 ring-4 ring-white shadow-xl">
              {specialist.image && <AvatarImage src={specialist.image} alt={specialist.name} />}
              <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-white text-xl font-semibold">
                {getInitials(`${specialist.user.firstName} ${specialist.user.lastName}`)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="text-xl font-bold text-slate-900">{specialist.name}</h3>
              <p className="text-primary font-medium">{specialist.user.jobTitle}</p>
              <Badge className="mt-2" variant="secondary">
                {appointmentType.name}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Date Card */}
            <div className="bg-white/90 backdrop-blur rounded-lg p-3 border border-primary/20">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-full bg-green-100">
                  <Calendar className="h-4 w-4 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground font-medium">Date</p>
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {format(dateTime, "EEE, MMM d")}
                  </p>
                </div>
              </div>
            </div>

            {/* Time Card */}
            <div className="bg-white/90 backdrop-blur rounded-lg p-3 border border-primary/20">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-full bg-blue-100">
                  <Clock className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground font-medium">Time</p>
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {formatInTimeZone(dateTime, timezone || "Australia/Sydney", "h:mm a")}&nbsp;
                    <span className="text-xs text-muted-foreground">
                      ({appointmentType.duration} min)
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* Format Card */}
            <div className="bg-white/90 backdrop-blur rounded-lg p-3 border border-primary/20">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-full bg-purple-100">
                  {appointmentType.appointmentMode === "telehealth" ? (
                    <Video className="h-4 w-4 text-purple-600" />
                  ) : (
                    <MapPin className="h-4 w-4 text-purple-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground font-medium">Format</p>
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {appointmentType.appointmentMode === "telehealth" ? "Telehealth" : "In-Person"}
                  </p>
                </div>
              </div>
            </div>

            {/* Timezone Card */}
            <div className="bg-white/90 backdrop-blur rounded-lg p-3 border border-primary/20">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-full bg-amber-100">
                  <Globe className="h-4 w-4 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground font-medium">Timezone</p>
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {timezone.replace("Australia/", "").replace("_", " ")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>
    );

    // Render the referrer form component
    const ReferrerFormCard = () => (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            Referrer Information
          </CardTitle>
          <CardDescription>Your details or whomever you are making the booking on behalf of</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <referrerForm.Field
              name="referrerFirstName"
              validators={{
                onChange: ({ value }) => {
                  if (!value) return "First name is required";
                  if (value.length < 2) return "First name must be at least 2 characters";
                  return undefined;
                },
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>
                    First Name<span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="John"
                  />
                  {field.state.meta.errors && (
                    <p className="text-sm text-red-500">{field.state.meta.errors[0]}</p>
                  )}
                </div>
              )}
            </referrerForm.Field>

            <referrerForm.Field
              name="referrerLastName"
              validators={{
                onChange: ({ value }) => {
                  if (!value) return "Last name is required";
                  if (value.length < 2) return "Last name must be at least 2 characters";
                  return undefined;
                },
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>
                    Last Name<span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Doe"
                  />
                  {field.state.meta.errors && (
                    <p className="text-sm text-red-500">{field.state.meta.errors[0]}</p>
                  )}
                </div>
              )}
            </referrerForm.Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <referrerForm.Field
              name="referrerEmail"
              validators={{
                onChange: ({ value }) => {
                  if (!value) return "Email is required";
                  const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
                  if (!emailRegex.test(value)) return "Please enter a valid email address";
                  return undefined;
                },
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>
                    Email<span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id={field.name}
                    type="email"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="john.doe@example.com"
                  />
                  {field.state.meta.errors && (
                    <p className="text-sm text-red-500">{field.state.meta.errors[0]}</p>
                  )}
                </div>
              )}
            </referrerForm.Field>

            <referrerForm.Field
              name="referrerPhone"
              validators={{
                onChange: ({ value }) => {
                  if (!value) return "Phone number is required";
                  const phoneRegex = /^[0-9+\-\s()]+$/;
                  if (!phoneRegex.test(value)) return "Please enter a valid phone number";
                  if (value.length < 10) return "Phone number must be at least 10 digits";
                  return undefined;
                },
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>
                    Phone Number<span className="text-destructive">*</span>
                  </Label>
                  <PhoneNumberInput
                    id={field.name}
                    value={field.state.value}
                    onChange={(value) => field.handleChange(value)}
                    onBlur={field.handleBlur}
                    placeholder="0400 000 000"
                  />
                  {field.state.meta.errors && (
                    <p className="text-sm text-red-500">{field.state.meta.errors[0]}</p>
                  )}
                </div>
              )}
            </referrerForm.Field>
          </div>
        </CardContent>
      </Card>
    );

    // Handle different render modes
    if (renderMode === "summary") {
      return <BookingSummaryCard />;
    }

    // Loading state
    if (isLoading) {
      return (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-32" />
          </CardContent>
        </Card>
      );
    }

    // Error state
    if (error || !formData) {
      return (
        <Card>
          <CardContent className="py-8">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Failed to load the intake form. Please try again or contact support if the issue
                persists.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      );
    }

    // Render forms with or without summary based on renderMode
    return (
      <div className="space-y-4">
        {renderMode === "full" && <BookingSummaryCard />}
        <ReferrerFormCard />
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <CardTitle>{formData.name || "Intake Form"}</CardTitle>
            </div>
            {formData.description && <CardDescription>{formData.description}</CardDescription>}
          </CardHeader>
          <CardContent>
            <AppFormRenderer
              ref={appFormRef}
              form={{
                id: formData.id,
                name: formData.name,
                fields: formData.fields.map((f, index) => ({
                  id: `${formData.id}-${f.acuityFieldId}-${index}`,
                  appFormId: formData.id,
                  acuityFieldId: f.acuityFieldId,
                  acuityField: f.acuityField
                    ? {
                        id: f.acuityField.id,
                        name: f.acuityField.name,
                        type: f.acuityField.type as
                          | "textbox"
                          | "textarea"
                          | "dropdown"
                          | "checkbox"
                          | "checkboxlist"
                          | "yesno"
                          | "file",
                        options: f.acuityField.options ?? undefined,
                        required: f.acuityField.required,
                      }
                    : undefined,
                  customLabel: f.customLabel ?? null,
                  placeholderText: undefined,
                  helpText: undefined,
                  tooltipText: undefined,
                  customFieldType: null,
                  isRequired: f.acuityField?.required ?? false,
                  validationRules: {},
                  isHidden: f.isHidden,
                  staticValue: null,
                  displayOrder: index + 1,
                  displayWidth: f.displayWidth ?? "full",
                })),
              }}
              defaultValues={extractDynamicFormValues(defaultValues)}
              onSubmit={handleDynamicFormSubmit}
              onValidationChange={handleDynamicFormValidationChange}
              submitLabel="Next"
              hideSubmitButton={hideSubmitButton}
            />
          </CardContent>
        </Card>
        <TermsModal />
      </div>
    );
  }
);

DynamicIntake.displayName = "DynamicIntake";
