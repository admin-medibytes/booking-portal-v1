"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SpecialistSelect } from "@/components/bookings/SpecialistSelect";
import { TimeSlotPicker } from "@/components/bookings/TimeSlotPicker";
import { ExamineeForm } from "@/components/bookings/ExamineeForm";
import { BookingConfirmation } from "@/components/bookings/BookingConfirmation";
import { MultiStepForm } from "@/components/forms/MultiStepForm";
import type { Specialist } from "@/types/booking";

const steps = [
  { id: "specialist", title: "Select Specialist", description: "Choose a specialist for the examination" },
  { id: "timeslot", title: "Choose Time", description: "Select an available appointment time" },
  { id: "details", title: "Examinee Details", description: "Provide information about the examinee" },
  { id: "confirmation", title: "Confirmation", description: "Review and confirm your booking" },
];

export default function NewBookingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentStep = parseInt(searchParams.get("step") || "1", 10);
  
  const [selectedSpecialist, setSelectedSpecialist] = useState<Specialist | null>(null);
  const [selectedDateTime, setSelectedDateTime] = useState<Date | null>(null);
  const [examineeData, setExamineeData] = useState<{
    examineeName: string;
    examineePhone: string;
    examineeEmail?: string | null;
    appointmentType: "in_person" | "telehealth";
    notes?: string | null;
  } | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);

  const updateStep = (step: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("step", step.toString());
    router.push(`/bookings/new?${params.toString()}`);
  };

  const handleNext = () => {
    if (currentStep < steps.length) {
      updateStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      updateStep(currentStep - 1);
    }
  };

  const handleSpecialistSelect = (specialist: Specialist) => {
    setSelectedSpecialist(specialist);
    handleNext();
  };

  const handleTimeSlotSelect = (dateTime: Date) => {
    setSelectedDateTime(dateTime);
    handleNext();
  };

  const handleExamineeSubmit = (data: typeof examineeData) => {
    setExamineeData(data);
    handleNext();
  };

  const handleBookingConfirm = (id: string) => {
    setBookingId(id);
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return selectedSpecialist !== null;
      case 2:
        return selectedDateTime !== null;
      case 3:
        return examineeData !== null;
      case 4:
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
          <TimeSlotPicker
            specialistId={selectedSpecialist.id}
            onSelect={handleTimeSlotSelect}
            selectedDateTime={selectedDateTime}
          />
        ) : (
          <div className="text-center text-muted-foreground">
            Please select a specialist first
          </div>
        );
      case 3:
        return selectedSpecialist && selectedDateTime ? (
          <ExamineeForm
            onSubmit={handleExamineeSubmit}
            defaultValues={examineeData || undefined}
          />
        ) : (
          <div className="text-center text-muted-foreground">
            Please complete previous steps first
          </div>
        );
      case 4:
        return selectedSpecialist && selectedDateTime && examineeData ? (
          <BookingConfirmation
            specialist={selectedSpecialist}
            dateTime={selectedDateTime}
            examineeData={examineeData}
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
    <div className="container max-w-4xl py-8">
      <Card>
        <CardHeader>
          <CardTitle>Create New Booking</CardTitle>
          <CardDescription>
            Schedule an independent medical examination
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MultiStepForm
            steps={steps}
            currentStep={currentStep}
            onStepClick={(step) => {
              if (step < currentStep) {
                updateStep(step);
              }
            }}
          />
          
          <div className="mt-8">
            {renderStepContent()}
          </div>

          <div className="mt-8 flex justify-between">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 1}
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            
            {currentStep < 4 && (
              <Button
                onClick={handleNext}
                disabled={!canProceed()}
              >
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}