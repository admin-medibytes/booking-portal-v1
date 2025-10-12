import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Organizations | Admin | Medibytes Booking Portal",
  description: "Manage organizations and their teams",
};

export default function OrganizationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
