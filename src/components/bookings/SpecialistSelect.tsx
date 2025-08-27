"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  MapPin,
  Video,
  User,
  MapPinned,
  Check,
  Eye,
  Search,
  Star,
  Mail,
  Phone,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { specialistsClient } from "@/lib/hono-client";
import {
  formatLocationShort,
  getLocationDisplay,
  getAppointmentTypeDisplay,
} from "@/lib/utils/location";
import { handleApiResponse } from "@/lib/hono-utils";
import { cn } from "@/lib/utils";
import type { Specialist } from "@/types/specialist";
import Link from "next/link";

interface SpecialistSelectProps {
  onSelect: (specialist: Specialist | null) => void;
  selectedSpecialist: Specialist | null;
}

export function SpecialistSelect({ onSelect, selectedSpecialist }: SpecialistSelectProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showContactModal, setShowContactModal] = useState(false);
  const [modalSpecialist, setModalSpecialist] = useState<Specialist | null>(null);

  const {
    data: specialists,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["specialists"],
    queryFn: async () => {
      const response = specialistsClient.$get();
      return await handleApiResponse<Specialist[]>(response);
    },
  });

  // Filter specialists based on search term
  const filteredSpecialists =
    specialists?.filter(
      (specialist) =>
        specialist.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        specialist.location?.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        specialist.location?.state?.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

  // Helper function to generate initials from name
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Helper function for rating (placeholder)
  // const getRating = (specialist: Specialist) => {
  //   // This is a placeholder - you might want to add actual rating data to your specialist model
  //   const rating = (Math.random() * 0.4 + 4.6).toFixed(1); // Random between 4.6-5.0
  //   return parseFloat(rating);
  // };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full max-w-md mx-auto" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-center gap-6">
                  <Skeleton className="h-16 w-16 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-6 w-1/3" />
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                  <Skeleton className="h-9 w-24" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Failed to load specialists. Please try again later.</AlertDescription>
      </Alert>
    );
  }

  if (!specialists || specialists.length === 0) {
    return (
      <Alert>
        <AlertDescription>
          No specialists are currently available. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  const rating = specialists.map(() => +(Math.random() * 2 + 3).toFixed(1));

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="relative max-w-md mx-auto">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
        <Input
          placeholder="Search specialists or locations..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-white border-slate-200 focus:border-primary focus:ring-primary/20"
        />
      </div>

      {/* Specialists List */}
      <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
        {filteredSpecialists.map((specialist, index) => {
          const isSelected = selectedSpecialist?.id === specialist.id;
          // const rating = getRating(specialist);

          return (
            <div
              key={specialist.id}
              className={cn(
                "group relative overflow-hidden rounded-xl border transition-all duration-300 cursor-pointer",
                "hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-0.5",
                isSelected
                  ? "bg-gradient-to-r from-primary/5 to-primary/10 border-primary/30 shadow-md shadow-primary/20"
                  : "bg-white border-slate-200 hover:border-primary/50 hover:bg-slate-50/50"
              )}
              onClick={() => {
                if (!specialist.acceptsTelehealth && !specialist.acceptsInPerson) {
                  setModalSpecialist(specialist);
                  setShowContactModal(true);
                  onSelect(null);
                } else {
                  onSelect(specialist);
                }
              }}
            >
              {/* Selection indicator bar */}
              <div
                className={cn(
                  "absolute left-0 top-0 bottom-0 w-1 transition-all duration-300",
                  isSelected
                    ? "bg-gradient-to-b from-primary to-primary/80"
                    : "bg-transparent group-hover:bg-primary/50"
                )}
              />

              <div className="flex items-center gap-6 p-6 pl-8">
                {/* Professional Avatar Section */}
                <div className="relative flex-shrink-0">
                  <Avatar className="w-16 h-16 ring-2 ring-white shadow-lg">
                    {specialist.image && (
                      <AvatarImage src={specialist.image} alt={specialist.name} />
                    )}
                    <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/30 text-xl font-semibold text-primary/80">
                      {getInitials(`${specialist.user.firstName} ${specialist.user.lastName}`)}
                    </AvatarFallback>
                  </Avatar>
                  {isSelected && (
                    <div className="absolute -top-1 -right-1 bg-primary text-white rounded-full p-1.5 shadow-lg">
                      <Check className="h-3 w-3" />
                    </div>
                  )}
                </div>

                {/* Main Information */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-1">
                        {specialist.name}
                      </h3>
                      <div className="flex items-center gap-3">
                        <span className="text-primary font-medium text-sm uppercase tracking-wide">
                          {specialist.user?.jobTitle || "Specialist"}
                        </span>
                        {/* <div className="flex items-center gap-1">
                          <div className="flex text-yellow-400 text-sm">
                            {"★".repeat(Math.floor(rating[index]))}
                          </div>
                          <span className="text-sm text-slate-500 font-medium">
                            {rating[index]}
                          </span>
                        </div> */}
                      </div>
                    </div>

                    {/* Experience Badge */}
                    {/* <div className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-sm font-medium shadow-2xs">
                      {experience}
                    </div> */}
                  </div>

                  {/* Location and Options Row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-600">
                      <MapPin className="h-4 w-4 text-slate-400" />
                      <span className="text-sm font-medium">
                        {getLocationDisplay(
                          specialist.acceptsInPerson || false,
                          specialist.acceptsTelehealth || true,
                          specialist.location ?? null
                        )}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {specialist.acceptsTelehealth && (
                        <Badge
                          variant="secondary"
                          className="text-xs px-3 py-1 font-medium border bg-blue-50 text-blue-700 border-blue-200"
                        >
                          Telehealth
                        </Badge>
                      )}
                      {specialist.acceptsInPerson && (
                        <Badge
                          variant="secondary"
                          className="text-xs px-3 py-1 font-medium border bg-violet-50 text-violet-700 border-violet-200"
                        >
                          In-person
                        </Badge>
                      )}
                      {!specialist.acceptsTelehealth && !specialist.acceptsInPerson && (
                        <Badge
                          variant="secondary"
                          className="text-xs px-3 py-1 font-medium border bg-gray-50 text-gray-700 border-gray-300"
                        >
                          Availability on request
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col items-center gap-3 flex-shrink-0">
                  <Button
                    size="sm"
                    className={cn(
                      "rounded gap-2 min-w-[100px] transition-all duration-200",
                      isSelected
                        ? "bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/25"
                        : "bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25"
                    )}
                  >
                    {isSelected ? (
                      <>
                        <Check className="h-4 w-4" />
                        Selected
                      </>
                    ) : (
                      <>
                        <User className="h-4 w-4" />
                        Select
                      </>
                    )}
                  </Button>

                  {specialist.slug && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded gap-2 border-slate-300 text-slate-600 hover:bg-slate-50 bg-white"
                      asChild
                    >
                      <Link
                        href={`https://medibytes.com.au/our-panel/${specialist.slug}`}
                        target="_blank"
                      >
                        <Eye className="h-4 w-4" />
                        View CV
                      </Link>
                    </Button>
                  )}
                </div>
              </div>

              {/* Hover effect overlay */}
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            </div>
          );
        })}
      </div>

      {filteredSpecialists.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="h-6 w-6 text-slate-400" />
          </div>
          <p className="text-slate-500 text-lg font-medium">No specialists found</p>
          <p className="text-slate-400 text-sm">Try adjusting your search terms</p>
        </div>
      )}

      {/* Contact Information Modal */}
      <Dialog open={showContactModal} onOpenChange={setShowContactModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Contact for Availability</DialogTitle>
            <DialogDescription>
              {modalSpecialist?.name} is available on request. Please contact our office to schedule
              an appointment.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-center space-x-3 p-4 bg-slate-50 rounded-lg">
              <Mail className="h-5 w-5 text-slate-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900">Email</p>
                <a
                  href="mailto:appointments@medibytes.com"
                  className="text-sm text-primary hover:underline"
                >
                  admin@medibytes.com.au
                </a>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-4 bg-slate-50 rounded-lg">
              <Phone className="h-5 w-5 text-slate-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900">Phone</p>
                <a href="tel:1800603920" className="text-sm text-primary hover:underline">
                  1800 603 920
                </a>
              </div>
            </div>

            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> When contacting us, please mention that you would like to
                schedule an appointment with {modalSpecialist?.name}.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowContactModal(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
