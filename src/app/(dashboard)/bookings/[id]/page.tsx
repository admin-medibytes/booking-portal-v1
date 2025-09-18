import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { BookingDetailClient } from "./booking-detail-client";
import { bookingService } from "@/server/services/booking.service";

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

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return notFound();
  }

  const booking = await bookingService.getBookingById(id, {
    id: session.user.id,
    role: session.user.role as "user" | "admin" | null,
  });

  // Check permissions
  const userOrgRole = session.session?.activeOrganizationId
    ? await bookingService.getUserOrganizationRole(
        session.user.id,
        session.session.activeOrganizationId
      )
    : undefined;

  const isSpecialistForBooking =
    userOrgRole === "specialist" &&
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
