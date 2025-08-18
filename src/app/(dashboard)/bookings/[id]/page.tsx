import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { BookingDetailClient } from "./booking-detail-client";
import { bookingService } from "@/server/services/booking.service";
import type { BookingWithDetails } from "@/hooks/use-booking";

interface BookingDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function BookingDetailPage({ params }: BookingDetailPageProps) {
  const { id } = await params;
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    notFound();
  }

  // Fetch booking data server-side
  let booking: BookingWithDetails | null = null;
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/bookings/${id}`, {
      headers: {
        cookie: (await headers()).get("cookie") || "",
      },
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch booking');
    }
    
    const data = await response.json() as { success: boolean; booking: BookingWithDetails };
    booking = data.booking;
  } catch {
    notFound();
  }

  if (!booking) {
    notFound();
  }

  // Check permissions
  const userOrgRole = session.session?.activeOrganizationId
    ? await bookingService.getUserOrganizationRole(session.user.id, session.session.activeOrganizationId)
    : undefined;
  
  const isSpecialistForBooking = userOrgRole === "specialist" && 
    booking.specialist?.id && 
    (await bookingService.isUserSpecialist(session.user.id, booking.specialist.id));
  
  const canUpdateProgress = session.user.role === "admin" || isSpecialistForBooking || false;

  return (
    <BookingDetailClient
      booking={booking}
      session={{
        user: {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
          role: session.user.role || "user",
        },
        session: session.session,
      }}
      canUpdateProgress={canUpdateProgress}
    />
  );
}