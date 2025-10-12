import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Integrations | Admin | Medibytes Booking Portal",
  description: "Connect external services to enhance your booking portal",
};

export default function IntegrationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
