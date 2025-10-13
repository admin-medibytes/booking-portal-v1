import { FileQuestion, Home } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { BrandSpan } from "@/components/font/span";
import { Button } from "@/components/ui/button";

export default function NotFound() {
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

      {/* 404 Content */}
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="mx-auto flex max-w-md flex-col items-center px-6 py-12 text-center">
          {/* Icon */}
          <div className="mb-6 flex size-24 items-center justify-center rounded-full bg-muted">
            <FileQuestion className="size-12 text-muted-foreground" />
          </div>

          {/* Title */}
          <h1 className="mb-2 text-4xl font-bold tracking-tight">404</h1>
          <h2 className="mb-4 text-xl font-semibold">Page not found</h2>

          {/* Description */}
          <p className="mb-8 text-sm text-muted-foreground">
            Sorry, we couldn&apos;t find the page you&apos;re looking for. The page might
            have been removed, had its name changed, or is temporarily
            unavailable.
          </p>

          {/* Actions */}
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild variant="default" className="w-full sm:w-auto">
              <Link href="/bookings">
                <Home className="mr-2 size-4" />
                View Bookings
              </Link>
            </Button>
            {/* <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href="/search">
                <Search className="mr-2 size-4" />
                
              </Link>
            </Button> */}
          </div>

          {/* Footer text */}
          <div className="mt-12 text-xs text-muted-foreground">
            <p>
              Error Code: 404 · <span>Page Not Found</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
