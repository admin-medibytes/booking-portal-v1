import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { BookingDetailClient } from "./booking-detail-client";
import { apiClient } from "@/lib/api-client";
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
    const response = await apiClient.get<{ success: boolean; booking: BookingWithDetails }>(
      `/bookings/${id}`,
      {
        headers: {
          cookie: (await headers()).get("cookie") || "",
        },
      }
    );
    booking = response.booking;
  } catch (_error) {
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