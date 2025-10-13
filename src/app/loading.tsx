import { LoaderCircle } from "lucide-react";
import Image from "next/image";

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        {/* Logo */}
        <Image
          width={48}
          height={48}
          src="/logo.png"
          alt="Medibytes Logo"
          className="size-12 object-contain animate-pulse"
        />

        {/* Spinner */}
        <LoaderCircle className="size-8 animate-spin text-primary" />

        {/* Loading text */}
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}