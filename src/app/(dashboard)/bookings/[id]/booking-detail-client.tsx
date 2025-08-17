"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { BookingDetailCard } from "@/components/bookings/booking-detail-card";
import { BookingProgressTracker } from "@/components/bookings/booking-progress-tracker";
import { BookingProgressUpdate } from "@/components/bookings/booking-progress-update";
import { DocumentsSection } from "@/components/bookings/documents-section";
import { useBookingWithDetails } from "@/hooks/use-booking";
import { useUpdateProgress } from "@/hooks/use-update-progress";
import type { BookingWithDetails } from "@/hooks/use-booking";

interface BookingDetailClientProps {
  booking: BookingWithDetails;
  session: {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
    };
    session: {
      id: string;
      userId: string;
      expiresAt: Date;
      activeOrganizationId?: string | null;
    };
  };
  canUpdateProgress: boolean;
}

export function BookingDetailClient({
  booking: initialBooking,
  session: _session,
  canUpdateProgress,
}: BookingDetailClientProps) {
  const router = useRouter();
  const [isProgressUpdateOpen, setIsProgressUpdateOpen] = useState(false);

  // Use client-side query for real-time updates
  const { data: booking, isLoading } = useBookingWithDetails(initialBooking.id);
  const _updateProgress = useUpdateProgress();

  const currentBooking = booking || initialBooking;

  const handleProgressUpdateSuccess = () => {
    setIsProgressUpdateOpen(false);
  };

  if (isLoading) {
    return (
      <div className="container py-6 mx-auto">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

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
            <h1 className="text-3xl font-bold text-gray-900">Booking Details</h1>
            <p className="text-sm text-gray-500 mt-1">ID: {currentBooking.id}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <BookingDetailCard booking={currentBooking} />
          <BookingProgressTracker
            currentProgress={currentBooking.currentProgress || "scheduled"}
            progressHistory={currentBooking.progress || []}
            canUpdateProgress={canUpdateProgress}
            onUpdateClick={() => setIsProgressUpdateOpen(true)}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <DocumentsSection
            bookingId={currentBooking.id}
          />
        </div>
      </div>

      {/* Progress Update Dialog */}
      <BookingProgressUpdate
        bookingId={currentBooking.id}
        currentProgress={currentBooking.currentProgress || "scheduled"}
        isOpen={isProgressUpdateOpen}
        onClose={() => setIsProgressUpdateOpen(false)}
        onSuccess={handleProgressUpdateSuccess}
      />
    </div>
  );
}