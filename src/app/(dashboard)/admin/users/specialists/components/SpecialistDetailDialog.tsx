"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminClient, specialistsClient } from "@/lib/hono-client";
import { debounce } from "@/lib/debounce";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  Loader2,
  Edit2,
  X,
  Check,
  User,
  Mail,
  Phone,
  MapPin,
  Building,
  Video,
  MapPinned,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { Country, State, City } from "country-state-city";
import type { SpecialistLocation } from "@/server/db/schema/specialists";
import { formatLocationFull, formatLocationShort } from "@/lib/utils/location";
import SpecialistImageUpload from "@/components/specialists/SpecialistImageUpload";
import Link from "next/link";
import { AppointmentTypesManagement } from "./AppointmentTypesManagement";

interface Specialist {
  id: string;
  userId: string;
  acuityCalendarId: string;
  name: string;
  slug: string | null;
  image?: string | null;
  location: SpecialistLocation | null;
  acceptsInPerson: boolean;
  acceptsTelehealth: boolean;
  position: number;
  isActive: boolean;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    jobTitle: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface ExtendedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  phoneNumber?: string | null;
  emailVerified?: boolean;
  banned?: boolean | null;
  image?: string | null;
  createdAt: string;
  memberships?: Array<{
    organizationId: string;
    organizationName: string;
    role: string;
    joinedAt: string | Date;
  }>;
}

interface SpecialistDetailDialogProps {
  specialist: Specialist;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SpecialistDetailDialog({
  specialist,
  open,
  onOpenChange,
}: SpecialistDetailDialogProps) {
  const queryClient = useQueryClient();
  const [isEditingSpecialist, setIsEditingSpecialist] = useState(false);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);

  // Memoize initial values to prevent recalculation
  const initialValues = useMemo(() => {
    // Determine country code from location
    let countryCode = "AU";
    if (specialist.location?.country) {
      const country = Country.getAllCountries().find(
        (c) => c.name === specialist.location?.country
      );
      countryCode = country?.isoCode || "AU";
    }

    // Get states for the country
    const states = State.getStatesOfCountry(countryCode);

    // Get cities if state exists
    let cities: any[] = [];
    if (specialist.location?.state && specialist.location?.country) {
      cities = City.getCitiesOfState(countryCode, specialist.location.state);
    }

    return {
      specialistForm: {
        name: specialist.name,
        slug: specialist.slug,
        acceptsInPerson: !!specialist.acceptsInPerson,
        acceptsTelehealth: !!specialist.acceptsTelehealth,
        location: specialist.location || null,
        isActive: !!specialist.isActive,
      },
      countryCode,
      states,
      cities,
      showLocationFields: !!specialist.location,
    };
  }, [specialist.id]); // Only recalculate when specialist ID changes

  // Initialize all state with computed initial values
  const [specialistForm, setSpecialistForm] = useState(initialValues.specialistForm);
  const [showLocationFields, setShowLocationFields] = useState(initialValues.showLocationFields);
  const [selectedCountryCode, setSelectedCountryCode] = useState(initialValues.countryCode);
  const [availableStates, setAvailableStates] = useState(initialValues.states);
  const [availableCities, setAvailableCities] = useState(initialValues.cities);

  const allCountries = Country.getAllCountries();

  // Debounced slug check function
  const debouncedCheckSlugAvailability = useMemo(
    () =>
      debounce(async (slug: string, currentSlug: string) => {
        // If it's the same as current slug, it's available
        if (slug === currentSlug) {
          setSlugAvailable(true);
          return;
        }

        if (!slug) {
          setSlugAvailable(null);
          return;
        }

        setCheckingSlug(true);
        try {
          const response = await specialistsClient["check-slug"].$post({
            json: { slug },
          });

          if (response.ok) {
            const data = await response.json();
            setSlugAvailable(data.available);
          } else {
            setSlugAvailable(null);
          }
        } catch {
          setSlugAvailable(null);
        } finally {
          setCheckingSlug(false);
        }
      }, 500),
    []
  );

  // Reset form when specialist changes (dialog opened with different specialist)
  useEffect(() => {
    if (open) {
      setSpecialistForm(initialValues.specialistForm);
      setShowLocationFields(initialValues.showLocationFields);
      setSelectedCountryCode(initialValues.countryCode);
      setAvailableStates(initialValues.states);
      setAvailableCities(initialValues.cities);
      setIsEditingSpecialist(false);
      setIsEditingUser(false);
    }
  }, [open, specialist.id, initialValues]);

  // Initialize user form state
  const [userForm, setUserForm] = useState({
    firstName: specialist.user.firstName,
    lastName: specialist.user.lastName,
    phone: "",
    jobTitle: specialist.user.jobTitle,
  });

  // Handle country changes
  const handleCountryChange = useCallback(
    (countryCode: string) => {
      setSelectedCountryCode(countryCode);
      const states = State.getStatesOfCountry(countryCode);
      setAvailableStates(states);

      const country = Country.getCountryByCode(countryCode);
      if (specialistForm.location) {
        setSpecialistForm((prev) => ({
          ...prev,
          location: {
            ...prev.location!,
            country: country?.name || "Australia",
            state: "",
            city: "",
          },
        }));
        setAvailableCities([]);
      }
    },
    [specialistForm.location]
  );

  // Handle state changes
  const handleStateChange = useCallback(
    (stateCode: string) => {
      setSpecialistForm((prev) => ({
        ...prev,
        location: {
          ...prev.location!,
          state: stateCode,
          city: "",
        },
      }));

      const cities = City.getCitiesOfState(selectedCountryCode, stateCode);
      setAvailableCities(cities);
    },
    [selectedCountryCode]
  );

  // Fetch detailed user data
  const { data: userData, refetch: refetchUser } = useQuery({
    queryKey: ["user", specialist.userId],
    queryFn: async () => {
      const response = await adminClient.users[":id"].$get({
        param: { id: specialist.userId },
      });
      if (!response.ok) throw new Error("Failed to fetch user details");
      return response.json();
    },
    enabled: open && !!specialist.userId,
  });

  // Update user form when user data is fetched
  useEffect(() => {
    if (userData?.user) {
      setUserForm({
        firstName: userData.user.firstName || "",
        lastName: userData.user.lastName || "",
        phone: userData.user.phoneNumber || "",
        jobTitle: userData.user.jobTitle || "",
      });
    }
  }, [userData]);

  // Update specialist mutation
  const updateSpecialistMutation = useMutation({
    mutationFn: async (values: {
      name?: string;
      slug?: string | null;
      image?: string | null;
      location?: SpecialistLocation | null;
      acceptsInPerson?: boolean;
      acceptsTelehealth?: boolean;
      isActive?: boolean;
    }) => {
      const payload = {
        name: values.name,
        slug: values.slug,
        image: values.image,
        location: values.location
          ? {
              streetAddress: values.location.streetAddress,
              suburb: values.location.suburb,
              city: values.location.city,
              state: values.location.state,
              postalCode: values.location.postalCode,
              country: values.location.country,
            }
          : null,
        acceptsInPerson: values.acceptsInPerson,
        acceptsTelehealth: values.acceptsTelehealth,
        isActive: values.isActive,
      };

      console.log("Sending payload to API:", payload);

      const response = await specialistsClient[":id"].$put({
        param: { id: specialist.id },
        json: payload,
      });

      if (!response.ok) {
        throw new Error(`Failed to update specialist`);
      }

      return response.json();
    },
    onSuccess: ({ data }) => {
      toast.success("Specialist updated successfully");
      setIsEditingSpecialist(false);

      // Update local form state with the returned data
      if (data) {
        // Update the form state
        const updatedForm = {
          name: data.name,
          slug: data.slug || "",
          acceptsInPerson: data.acceptsInPerson,
          acceptsTelehealth: data.acceptsTelehealth,
          location: data.location || null,
          isActive: data.isActive,
        };
        setSpecialistForm(updatedForm);
        setShowLocationFields(!!data.location);

        // Update country code if location exists
        if (data.location?.country) {
          const country = Country.getAllCountries().find((c) => c.name === data.location?.country);
          if (country) {
            setSelectedCountryCode(country.isoCode);
          }
        }

        // IMPORTANT: Update the parent specialist object to reflect changes in the UI
        // This ensures badges and status indicators update immediately
        Object.assign(specialist, {
          name: data.name,
          slug: data.slug,
          acceptsInPerson: data.acceptsInPerson,
          acceptsTelehealth: data.acceptsTelehealth,
          location: data.location,
          isActive: data.isActive,
          updatedAt: new Date().toISOString(),
        });
      }

      // Invalidate all specialist-related queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ["admin-specialists"] });
      queryClient.invalidateQueries({ queryKey: ["specialists"] });
      // Also invalidate appointment types since they depend on specialist data
      queryClient.invalidateQueries({ queryKey: ["appointment-types", specialist.id] });
    },
    onError: () => {
      toast.error("Failed to update specialist");
    },
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async (values: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      jobTitle?: string;
    }) => {
      const response = await adminClient.users[":id"].$put({
        param: { id: specialist.userId },
        json: values,
      });
      if (!response.ok) throw new Error("Failed to update user");
      return response.json();
    },
    onSuccess: () => {
      toast.success("User information updated successfully");
      setIsEditingUser(false);
      refetchUser();
      // Invalidate all specialist-related queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ["admin-specialists"] });
      queryClient.invalidateQueries({ queryKey: ["specialists"] });
      // Also invalidate user queries
      queryClient.invalidateQueries({ queryKey: ["user", specialist.userId] });
    },
    onError: () => {
      toast.error("Failed to update user information");
    },
  });

  const handleSaveSpecialist = () => {
    // Validate slug only if provided
    if (specialistForm.slug && slugAvailable === false) {
      toast.error("The selected slug is not available");
      return;
    }

    // Validate location fields if location is provided
    if (showLocationFields && specialistForm.location) {
      if (
        !specialistForm.location.city ||
        !specialistForm.location.state ||
        !specialistForm.location.country
      ) {
        toast.error("City, state, and country are required when adding a location");
        return;
      }
    }

    const dataToSend = {
      ...specialistForm,
      location: showLocationFields ? specialistForm.location : null,
    };

    console.log("Data being sent to mutation:", dataToSend);
    console.log("specialistForm.slug value:", specialistForm.slug);
    console.log("specialistForm.slug type:", typeof specialistForm.slug);

    updateSpecialistMutation.mutate(
      dataToSend as Parameters<typeof updateSpecialistMutation.mutate>[0]
    );
  };

  const handleCancelSpecialistEdit = () => {
    setIsEditingSpecialist(false);
    setSpecialistForm(initialValues.specialistForm);
    setShowLocationFields(initialValues.showLocationFields);
    setSelectedCountryCode(initialValues.countryCode);
    setAvailableStates(initialValues.states);
    setAvailableCities(initialValues.cities);
  };

  const formatLocation = (location: SpecialistLocation | null) => {
    if (!location) return "Not specified";
    return formatLocationFull(location);
  };

  const handleSaveUser = () => {
    updateUserMutation.mutate(userForm);
  };

  // Handle image upload
  const handleImageUpload = async (imageBlob: Blob | null) => {
    setIsUploadingImage(true);
    try {
      let imageUrl: string | null = null;

      if (imageBlob) {
        // Convert blob to base64 for storage
        const reader = new FileReader();
        imageUrl = await new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(imageBlob);
        });
      }

      // Update the specialist's image instead of user's image
      await updateSpecialistMutation.mutateAsync({ image: imageUrl });
      toast.success(imageUrl ? "Image uploaded successfully" : "Image removed successfully");
    } catch (error) {
      toast.error("Failed to update image");
      console.error(error);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleCancelUserEdit = () => {
    setIsEditingUser(false);
    const userToRevert = userData?.user || specialist.user;
    setUserForm({
      firstName: userToRevert.firstName || "",
      lastName: userToRevert.lastName || "",
      phone: (userData?.user as ExtendedUser)?.phoneNumber || "",
      jobTitle: userToRevert.jobTitle || "",
    });
  };

  const user: ExtendedUser = userData?.user || {
    ...specialist.user,
    phoneNumber: "",
    emailVerified: false,
    banned: false,
    image: null,
    createdAt: specialist.createdAt,
    memberships: [],
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Specialist Details
          </DialogTitle>
          <DialogDescription>
            View and manage specialist information, user details, and organizational assignments.
          </DialogDescription>
        </DialogHeader>

        {/* Top status badges - simplified */}
        <div className="flex items-center gap-2 mt-4">
          <Badge variant={specialist.isActive ? "success" : "secondary"} className="text-sm">
            {specialist.isActive ? "Active" : "Inactive"}
          </Badge>
          {user.emailVerified && (
            <Badge variant="outline" className="text-sm">
              Email Verified
            </Badge>
          )}
        </div>

        <Tabs defaultValue="specialist" className="mt-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="specialist">Specialist Info</TabsTrigger>
            <TabsTrigger value="user">User Details</TabsTrigger>
            <TabsTrigger value="organizations">Organizations</TabsTrigger>
            <TabsTrigger value="appointment-types">Appointment Types</TabsTrigger>
          </TabsList>

          <TabsContent value="specialist" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Specialist Information</CardTitle>
                {!isEditingSpecialist ? (
                  <Button variant="outline" size="sm" onClick={() => setIsEditingSpecialist(true)}>
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancelSpecialistEdit}
                      disabled={updateSpecialistMutation.isPending}
                    >
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveSpecialist}
                      disabled={updateSpecialistMutation.isPending}
                    >
                      {updateSpecialistMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4 mr-2" />
                      )}
                      Save
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Profile Section */}
                <div className="flex flex-col items-center space-y-4 pb-6 border-b">
                  <SpecialistImageUpload
                    currentImageUrl={specialist.image}
                    userName={specialist.name}
                    onImageChange={handleImageUpload}
                    isUploading={isUploadingImage}
                  />
                  <div className="text-center w-full max-w-sm">
                    {isEditingSpecialist ? (
                      <div className="space-y-2">
                        <Label>Display Name</Label>
                        <Input
                          value={specialistForm.name}
                          onChange={(e) =>
                            setSpecialistForm({ ...specialistForm, name: e.target.value })
                          }
                          placeholder="Enter display name"
                          className="text-center"
                        />
                      </div>
                    ) : (
                      <div>
                        <h3 className="text-lg font-semibold">{specialist.name}</h3>
                        <p className="text-sm text-muted-foreground">{specialist.user.jobTitle}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Specialist URL Section */}
                <div className="space-y-3">
                  <Label className="text-base font-medium">Specialist URL</Label>
                  {isEditingSpecialist ? (
                    <div className="space-y-2">
                      <div className="relative">
                        <Input
                          value={specialistForm.slug || ""}
                          onChange={(e) => {
                            const newSlug = e.target.value ? e.target.value : null;
                            setSpecialistForm({ ...specialistForm, slug: newSlug });
                            if (newSlug) {
                              debouncedCheckSlugAvailability(newSlug, specialist.slug || "");
                            } else {
                              setSlugAvailable(null);
                            }
                          }}
                          placeholder="john-smith (optional)"
                          className={
                            slugAvailable === false
                              ? "border-red-500"
                              : slugAvailable === true
                                ? "border-green-500"
                                : ""
                          }
                        />
                        {checkingSlug && (
                          <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin" />
                        )}
                      </div>
                      {slugAvailable === false && (
                        <p className="text-sm text-red-500">This slug is already taken</p>
                      )}
                      {slugAvailable === true && (
                        <p className="text-sm text-green-500">This slug is available</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {specialistForm.slug
                          ? `Specialist's profile will be available at: medibytes.com.au/our-panel/${specialistForm.slug}`
                          : "Optional: Leave empty if no public profile is needed"}
                      </p>
                    </div>
                  ) : (
                    <div>
                      {specialist.slug ? (
                        <>
                          <Link
                            href={`https://medibytes.com.au/our-panel/${specialist.slug}`}
                            className="text-sm font-mono bg-muted px-2 py-1 rounded hover:underline"
                            target="_blank"
                          >
                            medibytes.com.au/our-panel/{specialist.slug}
                          </Link>
                          <p className="text-xs text-muted-foreground mt-1">
                            Public URL for the specialist's profile page
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">No public profile URL</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Appointment Settings Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-medium">Appointment Settings</Label>
                    <div className="flex gap-2">
                      {!isEditingSpecialist && specialist.acceptsInPerson && (
                        <Badge variant="outline" className="text-xs">
                          <MapPinned className="w-3 h-3 mr-1" />
                          In-person
                        </Badge>
                      )}
                      {!isEditingSpecialist && specialist.acceptsTelehealth && (
                        <Badge variant="outline" className="text-xs">
                          <Video className="w-3 h-3 mr-1" />
                          Telehealth
                        </Badge>
                      )}
                      {!isEditingSpecialist &&
                        !specialist.acceptsInPerson &&
                        !specialist.acceptsTelehealth && (
                          <Badge variant="secondary" className="text-xs">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            On Request
                          </Badge>
                        )}
                    </div>
                  </div>
                  {isEditingSpecialist ? (
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="telehealth"
                          checked={!!specialistForm.acceptsTelehealth}
                          onCheckedChange={(checked) =>
                            setSpecialistForm({
                              ...specialistForm,
                              acceptsTelehealth: checked,
                            })
                          }
                        />
                        <Label
                          htmlFor="telehealth"
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <Video className="w-4 h-4" />
                          Telehealth appointments
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="in-person"
                          checked={!!specialistForm.acceptsInPerson}
                          onCheckedChange={(checked) =>
                            setSpecialistForm({
                              ...specialistForm,
                              acceptsInPerson: checked,
                            })
                          }
                        />
                        <Label
                          htmlFor="in-person"
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <MapPinned className="w-4 h-4" />
                          In-person appointments
                        </Label>
                      </div>

                      {!specialistForm.acceptsInPerson && !specialistForm.acceptsTelehealth && (
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            This specialist will be marked as "Availability on Request" - bookings
                            will need to be coordinated directly
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  ) : null}
                </div>

                {/* Location Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-medium">Practice Location</Label>
                    {!isEditingSpecialist && specialist.location && (
                      <Badge variant="outline" className="text-xs">
                        <MapPin className="w-3 h-3 mr-1" />
                        {formatLocationShort(specialist.location)}
                      </Badge>
                    )}
                  </div>
                  {isEditingSpecialist && specialistForm.acceptsInPerson ? (
                    <div className="space-y-3">
                      {!showLocationFields || !specialistForm.location ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowLocationFields(true);
                            setSelectedCountryCode("AU");
                            setSpecialistForm({
                              ...specialistForm,
                              location: {
                                streetAddress: "",
                                suburb: "",
                                city: "",
                                state: "",
                                postalCode: "",
                                country: "Australia",
                              },
                            });
                          }}
                        >
                          <MapPin className="w-4 h-4 mr-2" />
                          Add Location
                        </Button>
                      ) : (
                        <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
                          <div className="grid grid-cols-2 gap-3">
                            <Select value={selectedCountryCode} onValueChange={handleCountryChange}>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Country *" />
                              </SelectTrigger>
                              <SelectContent>
                                {allCountries.map((country) => (
                                  <SelectItem key={country.isoCode} value={country.isoCode}>
                                    {country.flag} {country.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select
                              value={specialistForm.location?.state || ""}
                              onValueChange={handleStateChange}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="State/Province *" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableStates.map((state) => (
                                  <SelectItem key={state.isoCode} value={state.isoCode}>
                                    {state.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <Select
                              value={specialistForm.location?.city || ""}
                              onValueChange={(value) =>
                                setSpecialistForm({
                                  ...specialistForm,
                                  location: {
                                    ...specialistForm.location!,
                                    city: value,
                                  },
                                })
                              }
                              disabled={!specialistForm.location?.state}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue
                                  placeholder={
                                    !specialistForm.location?.state
                                      ? "Select state first"
                                      : "City *"
                                  }
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {availableCities.map((city) => (
                                  <SelectItem key={city.name} value={city.name}>
                                    {city.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              placeholder="Postal Code"
                              value={specialistForm.location?.postalCode || ""}
                              onChange={(e) =>
                                setSpecialistForm({
                                  ...specialistForm,
                                  location: {
                                    ...specialistForm.location!,
                                    postalCode: e.target.value,
                                  },
                                })
                              }
                            />
                          </div>
                          <Input
                            placeholder="Suburb (optional)"
                            value={specialistForm.location?.suburb || ""}
                            onChange={(e) =>
                              setSpecialistForm({
                                ...specialistForm,
                                location: {
                                  ...specialistForm.location!,
                                  suburb: e.target.value,
                                },
                              })
                            }
                          />
                          <Input
                            placeholder="Street Address (optional)"
                            value={specialistForm.location?.streetAddress || ""}
                            onChange={(e) =>
                              setSpecialistForm({
                                ...specialistForm,
                                location: {
                                  ...specialistForm.location!,
                                  streetAddress: e.target.value,
                                },
                              })
                            }
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="w-full"
                            onClick={() => {
                              setShowLocationFields(false);
                              setSpecialistForm({
                                ...specialistForm,
                                location: null,
                              });
                            }}
                          >
                            <X className="w-4 h-4 mr-2" />
                            Remove Location
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm">
                      {specialistForm.acceptsInPerson
                        ? specialistForm.location
                          ? formatLocation(specialistForm.location)
                          : "Location TBD"
                        : "Online only"}
                    </p>
                  )}
                </div>

                {/* System Information Section */}
                <div className="space-y-3">
                  <Label className="text-base font-medium">System Information</Label>
                  <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Calendar ID</p>
                      <p className="font-mono text-sm">{specialist.acuityCalendarId}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Display Position</p>
                      <p className="text-sm font-medium">#{specialist.position}</p>
                    </div>
                    {!isEditingSpecialist && (
                      <div className="space-y-1 col-span-2">
                        <p className="text-xs text-muted-foreground">Status</p>
                        <Badge
                          variant={specialist.isActive ? "success" : "secondary"}
                          className="w-fit"
                        >
                          {specialist.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>

                {/* Active Status Toggle - only in edit mode */}
                {isEditingSpecialist && (
                  <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                    <Label htmlFor="active-status" className="text-sm font-medium">
                      Specialist Active
                    </Label>
                    <Switch
                      id="active-status"
                      checked={!!specialistForm.isActive}
                      onCheckedChange={(checked) =>
                        setSpecialistForm({ ...specialistForm, isActive: checked })
                      }
                    />
                  </div>
                )}

                {/* Timestamps - subtle at bottom */}
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Created {format(new Date(specialist.createdAt), "PP")}</span>
                    <span>Updated {format(new Date(specialist.updatedAt), "PP")}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="user" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>User Information</CardTitle>
                {!isEditingUser ? (
                  <Button variant="outline" size="sm" onClick={() => setIsEditingUser(true)}>
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancelUserEdit}
                      disabled={updateUserMutation.isPending}
                    >
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveUser}
                      disabled={updateUserMutation.isPending}
                    >
                      {updateUserMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4 mr-2" />
                      )}
                      Save
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>First Name</Label>
                    {isEditingUser ? (
                      <Input
                        value={userForm.firstName}
                        onChange={(e) => setUserForm({ ...userForm, firstName: e.target.value })}
                      />
                    ) : (
                      <p className="text-sm">{user.firstName}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Last Name</Label>
                    {isEditingUser ? (
                      <Input
                        value={userForm.lastName}
                        onChange={(e) => setUserForm({ ...userForm, lastName: e.target.value })}
                      />
                    ) : (
                      <p className="text-sm">{user.lastName}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <p className="text-sm">{user.email}</p>
                    {user.emailVerified && (
                      <Badge variant="outline" className="text-xs">
                        Verified
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Phone Number</Label>
                    {isEditingUser ? (
                      <Input
                        value={userForm.phone}
                        onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                        placeholder="Enter phone number"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <p className="text-sm">{user.phoneNumber || "Not provided"}</p>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Job Title</Label>
                    {isEditingUser ? (
                      <Input
                        value={userForm.jobTitle}
                        onChange={(e) => setUserForm({ ...userForm, jobTitle: e.target.value })}
                        placeholder="Enter job title"
                      />
                    ) : (
                      <p className="text-sm">{user.jobTitle || "Not specified"}</p>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <Label>Account Created</Label>
                  <p className="text-sm mt-1">{format(new Date(user.createdAt), "PPpp")}</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="organizations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Organization Memberships</CardTitle>
                <CardDescription>
                  All organizations and roles assigned to this specialist
                </CardDescription>
              </CardHeader>
              <CardContent>
                {user.memberships && user.memberships.length > 0 ? (
                  <div className="space-y-3">
                    {user.memberships.map((membership) => (
                      <div
                        key={membership.organizationId}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-start gap-3">
                          <Building className="w-5 h-5 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="font-medium">{membership.organizationName}</p>
                            <p className="text-sm text-muted-foreground">
                              Joined{" "}
                              {format(
                                typeof membership.joinedAt === "string"
                                  ? new Date(membership.joinedAt)
                                  : membership.joinedAt,
                                "PP"
                              )}
                            </p>
                          </div>
                        </div>
                        <Badge>{membership.role}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Building className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      No organization memberships found
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appointment-types" className="space-y-4">
            <AppointmentTypesManagement specialistId={specialist.id} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
