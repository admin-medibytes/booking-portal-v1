"use client";

import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { type } from "arktype";
import { useForm } from "@tanstack/react-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { PhoneNumberInput } from "@/components/ui/phone-input";
import {
  Phone,
  Mail,
  User,
  FileText,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Video,
  CheckCircle,
  UserCheck,
  ClipboardList,
  CalendarDays,
  Home,
  Briefcase,
  Shield,
} from "lucide-react";
import DOMPurify from "isomorphic-dompurify";
import { addMinutes, format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import type { Specialist } from "@/types/specialist";

const intakeFormSchema = type({
  // Referrer Information
  referrerFirstName: "string>0",
  referrerLastName: "string>0",
  referrerEmail: "string.email",
  referrerPhone: "string>0",

  // Examinee Information
  examineeFirstName: "string>0",
  examineeLastName: "string>0",
  examineeDateOfBirth: "string>0", // Will validate date format
  examineePhone: "string>0",
  "examineeEmail?": "string.email|null",
  examineeAddress: "string>0",

  // Medical & Case Information
  conditions: "string>0",
  caseType: "string>0",
  contactAuthorisation: "boolean",
  termsAccepted: "boolean",
  "specialNotes?": "string|null",
});

type IntakeFormData = typeof intakeFormSchema.infer;

interface IntakeFormProps {
  onSubmit: (data: IntakeFormData) => void;
  onValidationChange?: (isValid: boolean) => void;
  defaultValues?: IntakeFormData;
  specialist?: Specialist;
  appointmentType?: {
    id: string;
    name: string;
    duration: number;
    appointmentMode?: "in-person" | "telehealth";
  };
  dateTime?: Date;
  timezone?: string;
  hideSubmitButton?: boolean;
}

export interface IntakeFormRef {
  submit: () => void;
}

export const IntakeForm = forwardRef<IntakeFormRef, IntakeFormProps>(
  (
    {
      onSubmit,
      onValidationChange,
      defaultValues,
      specialist,
      appointmentType,
      dateTime,
      timezone,
      hideSubmitButton = false,
    },
    ref
  ) => {
    console.log("IntakeForm - Received timezone:", timezone);

    // Expose submit method via ref
    useImperativeHandle(ref, () => ({
      submit: () => {
        form.handleSubmit();
      },
    }));

    const form = useForm({
      defaultValues: defaultValues || {
        // Referrer defaults
        referrerFirstName: "",
        referrerLastName: "",
        referrerEmail: "",
        referrerPhone: "",
        // Examinee defaults
        examineeFirstName: "",
        examineeLastName: "",
        examineeDateOfBirth: "",
        examineePhone: "",
        examineeEmail: null,
        examineeAddress: "",
        // Medical & Case defaults
        conditions: "",
        caseType: "",
        contactAuthorisation: false,
        termsAccepted: false,
        specialNotes: null,
      },
      onSubmit: async ({ value }) => {
        // Sanitize all string inputs
        const sanitizedData: IntakeFormData = {
          // Referrer
          referrerFirstName: DOMPurify.sanitize(value.referrerFirstName),
          referrerLastName: DOMPurify.sanitize(value.referrerLastName),
          referrerEmail: DOMPurify.sanitize(value.referrerEmail),
          referrerPhone: DOMPurify.sanitize(value.referrerPhone),
          // Examinee
          examineeFirstName: DOMPurify.sanitize(value.examineeFirstName),
          examineeLastName: DOMPurify.sanitize(value.examineeLastName),
          examineeDateOfBirth: DOMPurify.sanitize(value.examineeDateOfBirth),
          examineePhone: DOMPurify.sanitize(value.examineePhone),
          examineeEmail: value.examineeEmail ? DOMPurify.sanitize(value.examineeEmail) : null,
          examineeAddress: DOMPurify.sanitize(value.examineeAddress),
          // Medical & Case
          conditions: DOMPurify.sanitize(value.conditions),
          caseType: DOMPurify.sanitize(value.caseType),
          contactAuthorisation: value.contactAuthorisation,
          termsAccepted: value.termsAccepted,
          specialNotes: value.specialNotes ? DOMPurify.sanitize(value.specialNotes) : null,
        };

        // Validate with ArkType
        const result = intakeFormSchema(sanitizedData);
        if (result instanceof type.errors) {
          // Handle validation errors
          return;
        }

        onSubmit(sanitizedData);
      },
    });

    // Track form validation state
    useEffect(() => {
      if (onValidationChange) {
        const checkValidation = () => {
          const values = form.state.values;
          const result = intakeFormSchema(values);
          onValidationChange(!(result instanceof type.errors));
        };
        checkValidation();
      }
    }, [form.state.values, onValidationChange]);

    return (
      <div className="space-y-4">
        {/* Booking Summary Card */}
        {specialist && appointmentType && dateTime && (
          <div className="bg-white border border-primary/20 rounded-2xl shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-primary to-primary/90 px-6 py-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                Booking Summary
              </h3>
            </div>

            <div className="p-6 bg-gradient-to-br from-primary/5 to-primary/10">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Specialist Information Card */}
                <div className="bg-white/80 backdrop-blur rounded-xl p-5 border border-primary/20">
                  <div className="flex items-center gap-4">
                    <Avatar className="w-16 h-16 ring-2 ring-white shadow-lg">
                      {specialist.image && (
                        <AvatarImage
                          src={specialist.image}
                          alt={`${specialist.user?.firstName} ${specialist.user?.lastName}`}
                        />
                      )}
                      <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/30 text-xl font-semibold text-primary">
                        {specialist.user?.firstName?.charAt(0)}
                        {specialist.user?.lastName?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        Specialist
                      </p>
                      <h4 className="font-semibold text-slate-900 text-lg">
                        {specialist.user?.firstName} {specialist.user?.lastName}
                      </h4>
                      <p className="text-primary text-sm font-medium tracking-wide">
                        {specialist.user?.jobTitle}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Appointment Details Card */}
                <div className="bg-white/80 backdrop-blur rounded-xl p-5 border border-primary/20">
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        Appointment Type
                      </p>
                      <h4 className="font-semibold text-slate-900 tracking-wide mb-1">
                        {appointmentType.name}
                      </h4>
                      <div className="flex items-center gap-3 mt-3">
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary text-xs font-medium rounded-full border border-primary/20">
                          <Clock className="w-3.5 h-3.5" />
                          {appointmentType.duration} min
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-full ${
                            appointmentType.appointmentMode === "telehealth"
                              ? "bg-blue-500/10 text-blue-700 border border-blue-500/20"
                              : "bg-purple-500/10 text-purple-700 border border-purple-500/20"
                          }`}
                        >
                          {appointmentType.appointmentMode === "telehealth" ? (
                            <Video className="w-3.5 h-3.5" />
                          ) : (
                            <MapPin className="w-3.5 h-3.5" />
                          )}
                          {appointmentType.appointmentMode === "telehealth"
                            ? "Telehealth"
                            : "In-Person"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Date & Time Section */}
              <div className="mt-6 bg-white/80 backdrop-blur rounded-xl p-5 border border-primary/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-primary/30 rounded-full flex items-center justify-center">
                      <CalendarIcon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900">Schedule For</h4>
                      <p className="text-slate-700 font-medium text-lg">
                        {formatInTimeZone(
                          dateTime,
                          timezone || "Australia/Sydney",
                          "EEEE, MMMM d, yyyy"
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-lg border border-primary/20">
                      <Clock className="w-4 h-4 text-primary" />
                      <span className="font-semibold text-slate-900 text-lg">
                        {formatInTimeZone(dateTime, timezone || "Australia/Sydney", "h:mm a")}
                        {" - "}
                        {formatInTimeZone(
                          addMinutes(dateTime, appointmentType.duration),
                          timezone || "Australia/Sydney",
                          "h:mm a"
                        )}
                      </span>
                    </div>
                    {timezone && (
                      <p className="text-xs text-slate-600 mt-1">
                        Timezone: {timezone.replace("Australia/", "")}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Intake Form */}
        <form
          onSubmit={(e: React.FormEvent) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="space-y-4"
        >
          {/* Referrer Information Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5" />
                Referrer Information
              </CardTitle>
              <CardDescription>Details of the person making this referral</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Referrer Name Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <form.Field
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
                      <Label htmlFor={field.name}>First Name *</Label>
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
                </form.Field>

                <form.Field
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
                      <Label htmlFor={field.name}>Last Name *</Label>
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
                </form.Field>
              </div>

              {/* Referrer Contact Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <form.Field
                  name="referrerEmail"
                  validators={{
                    onChange: ({ value }) => {
                      if (!value) return "Email is required";
                      if (!value.includes("@")) return "Invalid email format";
                      return undefined;
                    },
                  }}
                >
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor={field.name} className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Email *
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
                </form.Field>

                <form.Field
                  name="referrerPhone"
                  validators={{
                    onChange: ({ value }) => {
                      if (!value) return "Phone is required";
                      return undefined;
                    },
                  }}
                >
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor={field.name} className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        Phone *
                      </Label>
                      <PhoneNumberInput
                        value={field.state.value}
                        onChange={(value) => field.handleChange(value)}
                        onBlur={field.handleBlur}
                        placeholder="Enter phone number"
                        defaultCountry="AU"
                      />
                      {field.state.meta.errors && (
                        <p className="text-sm text-red-500">{field.state.meta.errors[0]}</p>
                      )}
                    </div>
                  )}
                </form.Field>
              </div>
            </CardContent>
          </Card>

          {/* Examinee Information Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Examinee & Medical Information
              </CardTitle>
              <CardDescription>
                Details of the person being examined and medical case information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Examinee Name Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <form.Field
                  name="examineeFirstName"
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
                      <Label htmlFor={field.name}>First Name *</Label>
                      <Input
                        id={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="Jane"
                      />
                      {field.state.meta.errors && (
                        <p className="text-sm text-red-500">{field.state.meta.errors[0]}</p>
                      )}
                    </div>
                  )}
                </form.Field>

                <form.Field
                  name="examineeLastName"
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
                      <Label htmlFor={field.name}>Last Name *</Label>
                      <Input
                        id={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="Smith"
                      />
                      {field.state.meta.errors && (
                        <p className="text-sm text-red-500">{field.state.meta.errors[0]}</p>
                      )}
                    </div>
                  )}
                </form.Field>
              </div>

              {/* DOB and Contact */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <form.Field
                  name="examineeDateOfBirth"
                  validators={{
                    onChange: ({ value }) => {
                      if (!value) return "Date of birth is required";
                      return undefined;
                    },
                  }}
                >
                  {(field) => {
                    const dateValue = field.state.value ? new Date(field.state.value) : undefined;
                    const maxDate = new Date();
                    const minDate = new Date();
                    minDate.setFullYear(minDate.getFullYear() - 120);

                    return (
                      <div className="space-y-2">
                        <Label htmlFor={field.name} className="flex items-center gap-2">
                          <CalendarDays className="h-4 w-4" />
                          Date of Birth *
                        </Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !dateValue && "text-muted-foreground"
                              )}
                            >
                              <CalendarDays className="mr-2 h-4 w-4" />
                              {dateValue ? format(dateValue, "PPP") : <span>Pick a date</span>}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={dateValue}
                              onSelect={(date) => {
                                if (date) {
                                  field.handleChange(format(date, "yyyy-MM-dd"));
                                }
                              }}
                              disabled={(date) => date > maxDate || date < minDate}
                              captionLayout="dropdown"
                              fromYear={minDate.getFullYear()}
                              toYear={maxDate.getFullYear()}
                              defaultMonth={dateValue || new Date(maxDate.getFullYear() - 30, 0)}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        {field.state.meta.errors && (
                          <p className="text-sm text-red-500">{field.state.meta.errors[0]}</p>
                        )}
                      </div>
                    );
                  }}
                </form.Field>

                <form.Field
                  name="examineePhone"
                  validators={{
                    onChange: ({ value }) => {
                      if (!value) return "Phone is required";
                      return undefined;
                    },
                  }}
                >
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor={field.name} className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        Phone *
                      </Label>
                      <PhoneNumberInput
                        value={field.state.value}
                        onChange={(value) => field.handleChange(value)}
                        onBlur={field.handleBlur}
                        placeholder="Enter phone number"
                        defaultCountry="AU"
                      />
                      {field.state.meta.errors && (
                        <p className="text-sm text-red-500">{field.state.meta.errors[0]}</p>
                      )}
                    </div>
                  )}
                </form.Field>

                <form.Field
                  name="examineeEmail"
                  validators={{
                    onChange: ({ value }) => {
                      if (value && !value.includes("@")) return "Invalid email format";
                      return undefined;
                    },
                  }}
                >
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor={field.name} className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Email (Optional)
                      </Label>
                      <Input
                        id={field.name}
                        type="email"
                        value={field.state.value || ""}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value || null)}
                        placeholder="jane.smith@example.com"
                      />
                      {field.state.meta.errors && (
                        <p className="text-sm text-red-500">{field.state.meta.errors[0]}</p>
                      )}
                    </div>
                  )}
                </form.Field>
              </div>

              {/* Address */}
              <form.Field
                name="examineeAddress"
                validators={{
                  onChange: ({ value }) => {
                    if (!value) return "Address is required";
                    if (value.length < 10) return "Please provide a complete address";
                    return undefined;
                  },
                }}
              >
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name} className="flex items-center gap-2">
                      <Home className="h-4 w-4" />
                      Address *
                    </Label>
                    <Textarea
                      id={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="123 Main St, City, State 12345"
                      rows={2}
                    />
                    {field.state.meta.errors && (
                      <p className="text-sm text-red-500">{field.state.meta.errors[0]}</p>
                    )}
                  </div>
                )}
              </form.Field>

              {/* Medical Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <form.Field
                  name="conditions"
                  validators={{
                    onChange: ({ value }) => {
                      if (!value) return "Medical conditions are required";
                      return undefined;
                    },
                  }}
                >
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor={field.name} className="flex items-center gap-2">
                        <ClipboardList className="h-4 w-4" />
                        Medical Conditions *
                      </Label>
                      <Textarea
                        id={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="List relevant medical conditions..."
                        rows={3}
                      />
                      {field.state.meta.errors && (
                        <p className="text-sm text-red-500">{field.state.meta.errors[0]}</p>
                      )}
                    </div>
                  )}
                </form.Field>

                <form.Field
                  name="caseType"
                  validators={{
                    onChange: ({ value }) => {
                      if (!value) return "Case type is required";
                      return undefined;
                    },
                  }}
                >
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor={field.name} className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4" />
                        Type of Case *
                      </Label>
                      <Input
                        id={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="e.g., Workers Compensation, Motor Vehicle Accident"
                      />
                      {field.state.meta.errors && (
                        <p className="text-sm text-red-500">{field.state.meta.errors[0]}</p>
                      )}
                    </div>
                  )}
                </form.Field>
              </div>

              {/* Consent Section */}
              <div className="space-y-3">
                {/* Contact Authorization */}
                <form.Field name="contactAuthorisation">
                  {(field) => (
                    <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <input
                        type="checkbox"
                        id={field.name}
                        checked={field.state.value}
                        onChange={(e) => field.handleChange(e.target.checked)}
                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                      />
                      <Label
                        htmlFor={field.name}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <Shield className="h-4 w-4" />I authorize contact regarding this examination
                      </Label>
                    </div>
                  )}
                </form.Field>

                {/* Terms and Conditions */}
                <form.Field name="termsAccepted">
                  {(field) => (
                    <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <input
                        type="checkbox"
                        id={field.name}
                        checked={field.state.value}
                        onChange={(e) => field.handleChange(e.target.checked)}
                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                      />
                      <Label
                        htmlFor={field.name}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <FileText className="h-4 w-4" />I agree to the Terms and Conditions of Trade
                      </Label>
                    </div>
                  )}
                </form.Field>
              </div>

              {/* Special Notes */}
              <form.Field name="specialNotes">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name} className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Special Notes (Optional)
                    </Label>
                    <Textarea
                      id={field.name}
                      value={field.state.value || ""}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value || null)}
                      placeholder="Any additional information or special requirements..."
                      rows={3}
                    />
                  </div>
                )}
              </form.Field>
            </CardContent>
          </Card>

          {/* Submit Button - only show if not hidden */}
          {!hideSubmitButton && (
            <div className="flex justify-end">
              <form.Subscribe
                selector={(formState) => ({
                  isSubmitting: formState.isSubmitting,
                  canSubmit: formState.canSubmit,
                })}
              >
                {({ isSubmitting, canSubmit }) => (
                  <Button type="submit" disabled={!canSubmit || isSubmitting} size="lg">
                    {isSubmitting ? "Processing..." : "Next"}
                  </Button>
                )}
              </form.Subscribe>
            </div>
          )}
        </form>
      </div>
    );
  }
);

IntakeForm.displayName = "IntakeForm";
