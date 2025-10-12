import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bookings | Medibytes Booking Portal",
  description: "Manage examinee appointments and referrals",
};

export default function BookingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
