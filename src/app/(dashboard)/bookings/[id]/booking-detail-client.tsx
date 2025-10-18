"use client";

import { useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { BookingDetailCard } from "@/components/bookings/booking-detail-card";
import { BookingProgressUpdate } from "@/components/bookings/booking-progress-update";
import { useBookingWithDetails } from "@/hooks/use-booking";
import type { BookingWithDetails } from "@/hooks/use-booking";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

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
  userRole: string | null;
  canUpdateProgress: boolean;
}

export function BookingDetailClient({ booking: initialBooking, session, userRole }: BookingDetailClientProps) {
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
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
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
        <BookingDetailCard booking={currentBooking} userRole={userRole} />
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
