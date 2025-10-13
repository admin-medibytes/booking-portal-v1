"use client";

import { AlertTriangle, Home, RotateCw } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { BrandSpan } from "@/components/font/span";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container flex h-16 items-center px-4">
          <Link href="/" className="flex items-center gap-2">
            <Image
              width={32}
              height={32}
              src="/logo.png"
              alt="Medibytes Logo"
              className="size-8 object-contain"
            />
            <BrandSpan>MEDIBYTES LEGAL</BrandSpan>
          </Link>
        </div>
      </header>

      {/* Error Content */}
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="mx-auto flex max-w-md flex-col items-center px-6 py-12 text-center">
          {/* Icon */}
          <div className="mb-6 flex size-24 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="size-12 text-destructive" />
          </div>

          {/* Title */}
          <h1 className="mb-2 text-2xl font-bold tracking-tight">
            Something went wrong!
          </h1>

          {/* Description */}
          <p className="mb-8 text-sm text-muted-foreground">
            We encountered an unexpected error. Our team has been notified and
            is working to fix the issue. Please try again or return to the
            bookings view.
          </p>

          {/* Actions */}
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
            <Button
              onClick={reset}
              variant="default"
              className="w-full sm:w-auto"
            >
              <RotateCw className="mr-2 size-4" />
              Try again
            </Button>
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href="/bookings">
                <Home className="mr-2 size-4" />
                Go to Bookings
              </Link>
            </Button>
          </div>

          {/* Error details (only in development) */}
          {process.env.NODE_ENV === "development" && error.message && (
            <div className="mt-8 w-full rounded-lg border bg-muted/50 p-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Error Details:
              </p>
              <p className="break-all text-xs text-muted-foreground">
                {error.message}
              </p>
              {error.digest && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Digest: {error.digest}
                </p>
              )}
            </div>
          )}

          {/* Footer text */}
          <div className="mt-12 text-xs text-muted-foreground">
            <p>
              If this problem persists,{" "}
              <a
                href="mailto:support@medibytes.com.au"
                className="underline hover:text-foreground"
              >
                contact support
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
