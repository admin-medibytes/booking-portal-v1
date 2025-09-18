"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { BookingDetailCard } from "@/components/bookings/booking-detail-card";
import { BookingProgressTracker } from "@/components/bookings/booking-progress-tracker";
import { BookingProgressUpdate } from "@/components/bookings/booking-progress-update";
import { useBookingWithDetails } from "@/hooks/use-booking";
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
  canUpdateProgress,
}: BookingDetailClientProps) {
  const router = useRouter();
  const [isProgressUpdateOpen, setIsProgressUpdateOpen] = useState(false);

  // Use client-side query for real-time updates
  const { data: booking, isLoading } = useBookingWithDetails(initialBooking.id);

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
      <div className="flex items-center justify-start mb-8">
        <div className="flex items-center gap-4">
          {/* <Button variant="ghost" size="sm" onClick={() => router.push("/bookings")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button> */}
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Booking Details</h1>
            <p className="text-sm text-gray-500 mt-1">
              View and manage the details for this booking.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="space-y-6">
        {/* <BookingProgressTracker
          currentProgress={currentBooking.currentProgress || "scheduled"}
          progressHistory={currentBooking.progress || []}
          canUpdateProgress={canUpdateProgress}
          onUpdateClick={() => setIsProgressUpdateOpen(true)}
        /> */}
        <BookingDetailCard booking={currentBooking} />
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
