"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminClient, specialistsClient } from "@/lib/hono-client";
import { debounce } from "@/lib/debounce";
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
import { Separator } from "@/components/ui/separator";
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
  ArrowLeft,
  ChevronRight,
  Calendar,
  Clock,
  Globe,
  Hash,
  Shield,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { Country, State, City } from "country-state-city";
import type { SpecialistLocation } from "@/server/db/schema/specialists";
import { formatLocationFull, formatLocationShort } from "@/lib/utils/location";
import SpecialistImageUpload from "@/components/specialists/SpecialistImageUpload";
import Link from "next/link";
import { AppointmentTypesManagement } from "../components/AppointmentTypesManagement";

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

export default function SpecialistDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const specialistId = params.id as string;

  const [isEditingSpecialist, setIsEditingSpecialist] = useState(false);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [isEditingPracticeDetails, setIsEditingPracticeDetails] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);

  // Fetch specialist data
  const { data: specialistData, isLoading: isLoadingSpecialist } = useQuery({
    queryKey: ["admin-specialist", specialistId],
    queryFn: async () => {
      const response = await adminClient.specialists.$get({
        query: { includeInactive: "true" },
      });
      if (!response.ok) throw new Error("Failed to fetch specialists");
      const data = await response.json();

      if ("error" in data) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Failed to fetch specialists"
        );
      }

      // Find the specific specialist by ID
      const specialist = data.data.find((s: Specialist) => s.id === specialistId);
      if (!specialist) {
        throw new Error("Specialist not found");
      }

      return { specialist };
    },
  });

  const specialist = specialistData?.specialist as Specialist | undefined;

  // Memoize initial values to prevent recalculation
  const initialValues = useMemo(() => {
    if (!specialist) return null;

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
        location: specialist.location || null,
        isActive: !!specialist.isActive,
      },
      countryCode,
      states,
      cities,
      showLocationFields: !!specialist.location,
    };
  }, [specialist?.id]); // Only recalculate when specialist ID changes

  // Initialize all state with computed initial values
  const [specialistForm, setSpecialistForm] = useState(
    initialValues?.specialistForm || {
      name: "",
      slug: null,
      location: null,
      isActive: false,
    }
  );
  const [showLocationFields, setShowLocationFields] = useState(
    initialValues?.showLocationFields || false
  );
  const [selectedCountryCode, setSelectedCountryCode] = useState(
    initialValues?.countryCode || "AU"
  );
  const [availableStates, setAvailableStates] = useState(initialValues?.states || []);
  const [availableCities, setAvailableCities] = useState(initialValues?.cities || []);
  
  // Practice Details form state
  const [practiceDetailsForm, setPracticeDetailsForm] = useState({
    location: initialValues?.specialistForm.location || null,
  });
  const [practiceShowLocationFields, setPracticeShowLocationFields] = useState(
    initialValues?.showLocationFields || false
  );
  const [practiceSelectedCountryCode, setPracticeSelectedCountryCode] = useState(
    initialValues?.countryCode || "AU"
  );
  const [practiceAvailableStates, setPracticeAvailableStates] = useState(
    initialValues?.states || []
  );
  const [practiceAvailableCities, setPracticeAvailableCities] = useState(
    initialValues?.cities || []
  );

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

  // Reset form when specialist changes
  useEffect(() => {
    if (initialValues) {
      setSpecialistForm(initialValues.specialistForm);
      setShowLocationFields(initialValues.showLocationFields);
      setSelectedCountryCode(initialValues.countryCode);
      setAvailableStates(initialValues.states);
      setAvailableCities(initialValues.cities);
      setIsEditingSpecialist(false);
      setIsEditingUser(false);
      setIsEditingPracticeDetails(false);
      // Reset practice details form
      setPracticeDetailsForm({
        location: initialValues.specialistForm.location || null,
      });
      setPracticeShowLocationFields(initialValues.showLocationFields);
      setPracticeSelectedCountryCode(initialValues.countryCode);
      setPracticeAvailableStates(initialValues.states);
      setPracticeAvailableCities(initialValues.cities);
    }
  }, [initialValues]);

  // Initialize user form state
  const [userForm, setUserForm] = useState({
    firstName: specialist?.user.firstName || "",
    lastName: specialist?.user.lastName || "",
    phone: "",
    jobTitle: specialist?.user.jobTitle || "",
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
    queryKey: ["user", specialist?.userId],
    queryFn: async () => {
      const response = await adminClient.users[":id"].$get({
        param: { id: specialist!.userId },
      });
      if (!response.ok) throw new Error("Failed to fetch user details");
      return response.json();
    },
    enabled: !!specialist?.userId,
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
        isActive: values.isActive,
      };

      const response = await specialistsClient[":id"].$put({
        param: { id: specialistId },
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

        // Update the parent specialist object to reflect changes in the UI
        if (specialist) {
          Object.assign(specialist, {
            name: data.name,
            slug: data.slug,
            location: data.location,
            isActive: data.isActive,
            updatedAt: new Date().toISOString(),
          });
        }
      }

      // Invalidate all specialist-related queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ["admin-specialists"] });
      queryClient.invalidateQueries({ queryKey: ["admin-specialist", specialistId] });
      queryClient.invalidateQueries({ queryKey: ["specialists"] });
      // Also invalidate appointment types since they depend on specialist data
      queryClient.invalidateQueries({ queryKey: ["appointment-types", specialistId] });
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
        param: { id: specialist!.userId },
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
      queryClient.invalidateQueries({ queryKey: ["admin-specialist", specialistId] });
      queryClient.invalidateQueries({ queryKey: ["specialists"] });
      // Also invalidate user queries
      queryClient.invalidateQueries({ queryKey: ["user", specialist?.userId] });
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

    updateSpecialistMutation.mutate(
      dataToSend as Parameters<typeof updateSpecialistMutation.mutate>[0]
    );
  };

  const handleCancelSpecialistEdit = () => {
    if (!initialValues) return;
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
    const userToRevert = userData?.user || specialist?.user;
    if (userToRevert) {
      setUserForm({
        firstName: userToRevert.firstName || "",
        lastName: userToRevert.lastName || "",
        phone: (userData?.user as ExtendedUser)?.phoneNumber || "",
        jobTitle: userToRevert.jobTitle || "",
      });
    }
  };

  // Practice Details handlers
  const handlePracticeCountryChange = useCallback(
    (countryCode: string) => {
      setPracticeSelectedCountryCode(countryCode);
      const states = State.getStatesOfCountry(countryCode);
      setPracticeAvailableStates(states);

      const country = Country.getCountryByCode(countryCode);
      if (practiceDetailsForm.location) {
        setPracticeDetailsForm((prev) => ({
          ...prev,
          location: {
            ...prev.location!,
            country: country?.name || "Australia",
            state: "",
            city: "",
          },
        }));
        setPracticeAvailableCities([]);
      }
    },
    [practiceDetailsForm.location]
  );

  const handlePracticeStateChange = useCallback(
    (stateCode: string) => {
      setPracticeDetailsForm((prev) => ({
        ...prev,
        location: {
          ...prev.location!,
          state: stateCode,
          city: "",
        },
      }));

      const cities = City.getCitiesOfState(practiceSelectedCountryCode, stateCode);
      setPracticeAvailableCities(cities);
    },
    [practiceSelectedCountryCode]
  );

  const handleSavePracticeDetails = () => {
    // Validate location fields if location is provided
    if (practiceShowLocationFields && practiceDetailsForm.location) {
      if (
        !practiceDetailsForm.location.city ||
        !practiceDetailsForm.location.state ||
        !practiceDetailsForm.location.country
      ) {
        toast.error("City, state, and country are required when adding a location");
        return;
      }
    }

    const dataToSend = {
      location: practiceShowLocationFields ? practiceDetailsForm.location : null,
    };

    updateSpecialistMutation.mutate(dataToSend, {
      onSuccess: () => {
        setIsEditingPracticeDetails(false);
        // Update the main specialist form state to reflect the saved changes
        setSpecialistForm(prev => ({
          ...prev,
          location: dataToSend.location
        }));
        setShowLocationFields(practiceShowLocationFields);
      }
    });
  };

  const handleCancelPracticeDetailsEdit = () => {
    if (!initialValues) return;
    setIsEditingPracticeDetails(false);
    setPracticeDetailsForm({
      location: initialValues.specialistForm.location || null,
    });
    setPracticeShowLocationFields(initialValues.showLocationFields);
    setPracticeSelectedCountryCode(initialValues.countryCode);
    setPracticeAvailableStates(initialValues.states);
    setPracticeAvailableCities(initialValues.cities);
  };

  const user: ExtendedUser | null =
    userData?.user ||
    (specialist
      ? {
          ...specialist.user,
          phoneNumber: "",
          emailVerified: false,
          banned: false,
          image: null,
          createdAt: specialist.createdAt,
          memberships: [],
        }
      : null);

  if (isLoadingSpecialist) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!specialist) {
    return (
      <div className="container mx-auto py-8">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Specialist not found</AlertDescription>
        </Alert>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/admin/users/specialists")}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Specialists
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 max-w-7xl">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/admin" className="hover:text-foreground transition-colors">
          Admin
        </Link>
        <ChevronRight className="w-4 h-4" />
        <Link href="/admin/users" className="hover:text-foreground transition-colors">
          Users
        </Link>
        <ChevronRight className="w-4 h-4" />
        <Link href="/admin/users/specialists" className="hover:text-foreground transition-colors">
          Specialists
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-foreground font-medium">{specialist.name}</span>
      </div>

      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/admin/users/specialists")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <User className="w-8 h-8" />
              {specialist.name}
            </h1>
            <p className="text-muted-foreground">
              Manage specialist profile, appointments, and access
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={specialist.isActive ? "success" : "secondary"} className="text-sm">
            {specialist.isActive ? "Active" : "Inactive"}
          </Badge>
          {user && user.emailVerified && (
            <Badge variant="outline" className="text-sm">
              <Shield className="w-3 h-3 mr-1" />
              Verified
            </Badge>
          )}
        </div>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="gap-2">
          <TabsTrigger value="profile">Profile & Identity</TabsTrigger>
          <TabsTrigger value="configuration">Configuration & Settings</TabsTrigger>
        </TabsList>

        {/* Tab 1: Profile & Identity */}
        <TabsContent value="profile" className="space-y-6">
          {/* Profile Information Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Basic information and display settings</CardDescription>
              </div>
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
              {/* Profile Image and Name */}
              <div className="flex items-start gap-6">
                <SpecialistImageUpload
                  currentImageUrl={specialist.image}
                  userName={specialist.name}
                  onImageChange={handleImageUpload}
                  isUploading={isUploadingImage}
                />
                <div className="flex-1 space-y-4">
                  {isEditingSpecialist ? (
                    <div className="space-y-4">
                      <div>
                        <Label>Display Name</Label>
                        <Input
                          value={specialistForm.name}
                          onChange={(e) =>
                            setSpecialistForm({ ...specialistForm, name: e.target.value })
                          }
                          placeholder="Enter display name"
                          className="mt-1"
                        />
                      </div>
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
                    </div>
                  ) : (
                    <div>
                      <h3 className="text-xl font-semibold">{specialist.name}</h3>
                      <p className="text-muted-foreground">{specialist.user.jobTitle}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge
                          variant={specialist.isActive ? "success" : "secondary"}
                          className="text-xs"
                        >
                          {specialist.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Public URL */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  <Label className="text-base font-medium">Public Profile URL</Label>
                </div>
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
                        ? `Profile will be available at: medibytes.com.au/our-panel/${specialistForm.slug}`
                        : "Optional: Leave empty if no public profile is needed"}
                    </p>
                  </div>
                ) : (
                  <div>
                    {specialist.slug ? (
                      <>
                        <Link
                          href={`https://medibytes.com.au/our-panel/${specialist.slug}`}
                          className="text-sm font-mono bg-muted px-3 py-1.5 rounded hover:underline inline-block"
                          target="_blank"
                        >
                          medibytes.com.au/our-panel/{specialist.slug}
                        </Link>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No public profile URL configured
                      </p>
                    )}
                  </div>
                )}
              </div>

              <Separator />

              {/* Timestamps */}
              <div className="text-xs text-muted-foreground">
                Created {format(new Date(specialist.createdAt), "PP 'at' p")} • Last updated{" "}
                {formatDistanceToNow(new Date(specialist.updatedAt), { addSuffix: true })}
              </div>
            </CardContent>
          </Card>

          {/* User Account Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>User Account</CardTitle>
                <CardDescription>Contact information and account details</CardDescription>
              </div>
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
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  {isEditingUser ? (
                    <Input
                      value={userForm.firstName}
                      onChange={(e) => setUserForm({ ...userForm, firstName: e.target.value })}
                    />
                  ) : (
                    <p className="text-sm">{user?.firstName || ""}</p>
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
                    <p className="text-sm">{user?.lastName || ""}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <p className="text-sm">{user?.email || ""}</p>
                    {user && user.emailVerified && (
                      <Badge variant="outline" className="text-xs">
                        Verified
                      </Badge>
                    )}
                  </div>
                </div>
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
                      <p className="text-sm">{user?.phoneNumber || "Not provided"}</p>
                    </div>
                  )}
                </div>
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
                  <p className="text-sm">{user?.jobTitle || "Not specified"}</p>
                )}
              </div>

              <Separator />

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Account Created</Label>
                <p className="text-sm">{user ? format(new Date(user.createdAt), "PPpp") : "N/A"}</p>
              </div>
            </CardContent>
          </Card>

          {/* Organization Memberships Card */}
          <Card>
            <CardHeader>
              <CardTitle>Organization Memberships</CardTitle>
              <CardDescription>
                All organizations and roles assigned to this specialist
              </CardDescription>
            </CardHeader>
            <CardContent>
              {user && user.memberships && user.memberships.length > 0 ? (
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
                  <p className="text-sm text-muted-foreground">No organization memberships found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Configuration & Settings */}
        <TabsContent value="configuration" className="space-y-6">
          {/* Scheduling Configuration Card */}
          <Card>
            <CardHeader>
              <CardTitle>Scheduling Configuration</CardTitle>
              <CardDescription>Calendar integration and sync settings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <p className="text-xs">Acuity Calendar ID</p>
                  </div>
                  <p className="font-mono text-sm bg-muted px-2 py-1 rounded inline-block">
                    {specialist.acuityCalendarId}
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <p className="text-xs">Sync Status</p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Connected
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Appointment Types Management */}
          <AppointmentTypesManagement specialistId={specialist.id} />

          {/* Practice Details Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Practice Details</CardTitle>
                <CardDescription>Appointment types and location settings</CardDescription>
              </div>
              {!isEditingPracticeDetails ? (
                <Button variant="outline" size="sm" onClick={() => setIsEditingPracticeDetails(true)}>
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelPracticeDetailsEdit}
                    disabled={updateSpecialistMutation.isPending}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSavePracticeDetails}
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
              {/* Appointment Settings - Derived from appointment types */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">Available Appointment Modes</Label>
                  <div className="flex gap-2">
                    {specialist.acceptsInPerson && (
                      <Badge variant="outline" className="text-xs">
                        <MapPinned className="w-3 h-3 mr-1" />
                        In-person
                      </Badge>
                    )}
                    {specialist.acceptsTelehealth && (
                      <Badge variant="outline" className="text-xs">
                        <Video className="w-3 h-3 mr-1" />
                        Telehealth
                      </Badge>
                    )}
                    {!specialist.acceptsInPerson && !specialist.acceptsTelehealth && (
                      <Badge variant="secondary" className="text-xs">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        No Active Types
                      </Badge>
                    )}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  These modes are automatically determined by the enabled appointment types above.
                  To change availability, enable or disable specific appointment types.
                </p>
              </div>

              <Separator />

              {/* Location */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <Label className="text-base font-medium">Practice Location</Label>
                  </div>
                  {!isEditingSpecialist && specialist.location && (
                    <Badge variant="outline" className="text-xs">
                      {formatLocationShort(specialist.location)}
                    </Badge>
                  )}
                </div>
                {isEditingPracticeDetails ? (
                  <div className="space-y-3">
                    {!practiceShowLocationFields || !practiceDetailsForm.location ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setPracticeShowLocationFields(true);
                          setPracticeSelectedCountryCode("AU");
                          setPracticeDetailsForm({
                            ...practiceDetailsForm,
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
                          <Select value={practiceSelectedCountryCode} onValueChange={handlePracticeCountryChange}>
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
                            value={practiceDetailsForm.location?.state || ""}
                            onValueChange={handlePracticeStateChange}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="State/Province *" />
                            </SelectTrigger>
                            <SelectContent>
                              {practiceAvailableStates.map((state) => (
                                <SelectItem key={state.isoCode} value={state.isoCode}>
                                  {state.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <Select
                            value={practiceDetailsForm.location?.city || ""}
                            onValueChange={(value) =>
                              setPracticeDetailsForm({
                                ...practiceDetailsForm,
                                location: {
                                  ...practiceDetailsForm.location!,
                                  city: value,
                                },
                              })
                            }
                            disabled={!practiceDetailsForm.location?.state}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue
                                placeholder={
                                  !practiceDetailsForm.location?.state ? "Select state first" : "City *"
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {practiceAvailableCities.map((city) => (
                                <SelectItem key={city.name} value={city.name}>
                                  {city.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            placeholder="Postal Code"
                            value={practiceDetailsForm.location?.postalCode || ""}
                            onChange={(e) =>
                              setPracticeDetailsForm({
                                ...practiceDetailsForm,
                                location: {
                                  ...practiceDetailsForm.location!,
                                  postalCode: e.target.value,
                                },
                              })
                            }
                          />
                        </div>
                        <Input
                          placeholder="Suburb (optional)"
                          value={practiceDetailsForm.location?.suburb || ""}
                          onChange={(e) =>
                            setPracticeDetailsForm({
                              ...practiceDetailsForm,
                              location: {
                                ...practiceDetailsForm.location!,
                                suburb: e.target.value,
                              },
                            })
                          }
                        />
                        <Input
                          placeholder="Street Address (optional)"
                          value={practiceDetailsForm.location?.streetAddress || ""}
                          onChange={(e) =>
                            setPracticeDetailsForm({
                              ...practiceDetailsForm,
                              location: {
                                ...practiceDetailsForm.location!,
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
                            setPracticeShowLocationFields(false);
                            setPracticeDetailsForm({
                              ...practiceDetailsForm,
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
                    {specialist.location
                      ? formatLocation(specialist.location)
                      : specialist.acceptsInPerson
                        ? "Location TBD"
                        : "No location configured"}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* System Settings Card */}
          <Card>
            <CardHeader>
              <CardTitle>System Settings</CardTitle>
              <CardDescription>Display order and metadata</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Hash className="w-4 h-4" />
                    <p className="text-xs">Display Position</p>
                  </div>
                  <p className="text-sm font-medium">Position #{specialist.position}</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <p className="text-xs">Last Updated</p>
                  </div>
                  <p className="text-sm font-medium">
                    {formatDistanceToNow(new Date(specialist.updatedAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
              <Separator className="my-4" />
              <div className="text-xs text-muted-foreground">
                Created {format(new Date(specialist.createdAt), "PP 'at' p")}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}