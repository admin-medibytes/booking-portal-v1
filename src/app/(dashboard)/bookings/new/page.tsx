"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  User,
  Calendar,
  Clock,
  FileText,
  CheckCircle,
} from "lucide-react";
import { SpecialistSelect } from "@/components/bookings/SpecialistSelect";
import { AppointmentTypeSelect } from "@/components/bookings/AppointmentTypeSelect";
import { TimeSlotPicker } from "@/components/bookings/TimeSlotPicker";
import { DynamicIntake } from "@/components/bookings/DynamicIntake";
import { BookingConfirmation } from "@/components/bookings/BookingConfirmation";
import { MultiStepForm } from "@/components/forms/MultiStepForm";
import { BookingSettingsModal } from "@/components/bookings/BookingSettingsModal";
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

const steps = [
  {
    id: "specialist",
    title: "Select Specialist",
    description: "Choose a specialist for the examination",
    icon: User,
  },
  {
    id: "appointment-type",
    title: "Appointment Type",
    description: "Select the type of appointment",
    icon: Calendar,
  },
  {
    id: "timeslot",
    title: "Choose Time",
    description: "Select an available appointment time",
    icon: Clock,
  },
  {
    id: "details",
    title: "Intake Form",
    description: "Provide information about the booking",
    icon: FileText,
  },
  {
    id: "confirmation",
    title: "Confirmation",
    description: "Review and confirm your booking",
    icon: CheckCircle,
  },
];

export default function NewBookingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentStep = parseInt(searchParams.get("step") || "1", 10);

  const [selectedSpecialist, setSelectedSpecialist] = useState<Specialist | null>(null);
  const [selectedAppointmentType, setSelectedAppointmentType] = useState<{
    id: string;
    acuityAppointmentTypeId: number;
    name: string;
    duration: number;
    description: string | null;
    category: string | null;
    appointmentMode: "in-person" | "telehealth";
  } | null>(null);
  const [selectedDateTime, setSelectedDateTime] = useState<Date | null>(null);
  const [selectedDatetimeString, setSelectedDatetimeString] = useState<string | null>(null);
  const [selectedTimezone, setSelectedTimezone] = useState<string>("Australia/Sydney");
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);
  const [selectedOrganizationSlug, setSelectedOrganizationSlug] = useState<string | null>(null);
  const [intakeFormData, setIntakeFormData] = useState<IntakeFormData | null>(null);
  const [formConfiguration, setFormConfiguration] = useState<any>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [isIntakeFormValid, setIsIntakeFormValid] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [hasConfirmedSettings, setHasConfirmedSettings] = useState(false);
  const intakeFormRef = useRef<{ submit: () => void } | null>(null);

  // Show settings modal on component mount (first visit to specialist selection)
  useEffect(() => {
    if (currentStep === 1 && !hasConfirmedSettings) {
      setShowSettingsModal(true);
    }
  }, [currentStep, hasConfirmedSettings]);

  const updateStep = (step: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("step", step.toString());
    router.push(`/bookings/new?${params.toString()}`);
  };

  const handleNext = () => {
    // If we're on the intake form step, trigger form submission
    if (currentStep === 4 && intakeFormRef.current) {
      intakeFormRef.current.submit();
      return;
    }

    if (currentStep < steps.length) {
      updateStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      updateStep(currentStep - 1);
    }
  };

  const handleSpecialistSelect = (specialist: Specialist | null) => {
    setSelectedSpecialist(specialist);
  };

  const handleAppointmentTypeSelect = (appointmentType: {
    id: string;
    acuityAppointmentTypeId: number;
    name: string;
    description: string | null;
    duration: number;
    category: string | null;
    appointmentMode: "in-person" | "telehealth";
  }) => {
    setSelectedAppointmentType(appointmentType);
  };

  const handleTimeSlotSelect = (dateTime: Date, datetimeString: string, timezone: string) => {
    setSelectedDateTime(dateTime);
    setSelectedDatetimeString(datetimeString);
    setSelectedTimezone(timezone);
  };

  const handleTimezoneChange = (timezone: string) => {
    setSelectedTimezone(timezone);
    // Clear selected time when timezone changes as it's no longer valid
    setSelectedDateTime(null);
    setSelectedDatetimeString(null);
  };

  const handleIntakeFormSubmit = (data: IntakeFormData) => {
    setIntakeFormData(data);
    // Move to next step after successful submission
    updateStep(5);
  };

  const handleIntakeFormValidation = (isValid: boolean) => {
    setIsIntakeFormValid(isValid);
  };

  const handleBookingConfirm = (id: string) => {
    setBookingId(id);
  };

  const handleSettingsConfirm = (timezone: string, organizationId: string, organizationSlug: string) => {
    setSelectedTimezone(timezone);
    setSelectedOrganizationId(organizationId);
    setSelectedOrganizationSlug(organizationSlug);
    setHasConfirmedSettings(true);
    setShowSettingsModal(false);
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return selectedSpecialist !== null;
      case 2:
        return selectedAppointmentType !== null;
      case 3:
        return selectedDateTime !== null;
      case 4:
        return isIntakeFormValid;
      case 5:
        return bookingId !== null;
      default:
        return false;
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <SpecialistSelect
            onSelect={handleSpecialistSelect}
            selectedSpecialist={selectedSpecialist}
          />
        );
      case 2:
        return selectedSpecialist ? (
          <AppointmentTypeSelect
            specialistId={selectedSpecialist.id}
            onSelect={handleAppointmentTypeSelect}
            selectedAppointmentType={selectedAppointmentType}
          />
        ) : (
          <div className="text-center text-muted-foreground">Please select a specialist first</div>
        );
      case 3:
        return selectedSpecialist && selectedAppointmentType ? (
          <TimeSlotPicker
            specialistId={selectedSpecialist.id}
            appointmentTypeId={selectedAppointmentType.acuityAppointmentTypeId}
            onSelect={handleTimeSlotSelect}
            onTimezoneChange={handleTimezoneChange}
            selectedDateTime={selectedDateTime}
            selectedTimezone={selectedTimezone}
            specialist={selectedSpecialist}
            appointmentType={{
              name: selectedAppointmentType.name,
              duration: selectedAppointmentType.duration,
              appointmentMode: selectedAppointmentType.appointmentMode,
            }}
          />
        ) : (
          <div className="text-center text-muted-foreground">
            Please complete previous steps first
          </div>
        );
      case 4:
        return selectedSpecialist && selectedAppointmentType && selectedDateTime && selectedDatetimeString ? (
          <DynamicIntake
            ref={intakeFormRef}
            specialist={selectedSpecialist}
            appointmentType={selectedAppointmentType}
            dateTime={selectedDateTime}
            datetimeString={selectedDatetimeString}
            timezone={selectedTimezone}
            onSubmit={handleIntakeFormSubmit}
            onValidationChange={handleIntakeFormValidation}
            onFormConfigurationLoaded={setFormConfiguration}
            defaultValues={intakeFormData || undefined}
            hideSubmitButton={true}
          />
        ) : (
          <div className="text-center text-muted-foreground">
            Please complete previous steps first
          </div>
        );
      case 5:
        return selectedSpecialist &&
          selectedAppointmentType &&
          selectedDateTime &&
          selectedDatetimeString &&
          intakeFormData &&
          selectedOrganizationSlug ? (
          <BookingConfirmation
            specialist={selectedSpecialist}
            appointmentType={selectedAppointmentType}
            dateTime={selectedDateTime}
            datetimeString={selectedDatetimeString}
            timezone={selectedTimezone}
            organizationSlug={selectedOrganizationSlug}
            intakeFormFields={intakeFormData}
            formConfiguration={formConfiguration}
            onConfirm={handleBookingConfirm}
            bookingId={bookingId}
          />
        ) : (
          <div className="text-center text-muted-foreground">
            Please complete all previous steps first
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="container max-w-7xl py-8">
        <div className="mb-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Create New Booking</h1>
            <p className="text-slate-600">Schedule an independent medical examination</p>
          </div>
        </div>

        <MultiStepForm
          steps={steps}
          currentStep={currentStep}
          onStepClick={(step) => {
            if (step < currentStep) {
              updateStep(step);
            }
          }}
        />

        <div className="space-y-6">
          {/* Step Header */}
          <div>
            <h2 className="text-2xl font-semibold">{steps[currentStep - 1].title}</h2>
            <p className="text-muted-foreground mt-1">{steps[currentStep - 1].description}</p>
          </div>

          {/* Step Content */}
          <div>{renderStepContent()}</div>

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-6">
            <Button variant="outline" onClick={handleBack} disabled={currentStep === 1}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back
            </Button>

            {currentStep < 5 && (
              <Button onClick={handleNext} disabled={!canProceed()}>
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      <BookingSettingsModal
        isOpen={showSettingsModal}
        onConfirm={handleSettingsConfirm}
        defaultTimezone={selectedTimezone}
        defaultOrganizationId={selectedOrganizationId || undefined}
      />
    </div>
  );
}
