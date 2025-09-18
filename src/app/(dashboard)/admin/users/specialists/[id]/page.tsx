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
  Link2,
  Settings,
  Activity,
  Briefcase,
  UserCircle,
  Database,
  CalendarDays,
  ListChecks,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { Country, State, City } from "country-state-city";
import type { SpecialistLocation } from "@/server/db/schema/specialists";
import { formatLocationFull, formatLocationShort } from "@/lib/utils/location";
import SpecialistImageUpload from "@/components/specialists/SpecialistImageUpload";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { AppointmentTypesModal } from "../components/AppointmentTypesModal";
import { EditableAppointmentTypeCard } from "../components/EditableAppointmentTypeCard";

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

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isEditingAccount, setIsEditingAccount] = useState(false);
  const [isEditingPractice, setIsEditingPractice] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);
  const [showAppointmentTypesModal, setShowAppointmentTypesModal] = useState(false);

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

      const specialist = data.data.find((s: Specialist) => s.id === specialistId);
      if (!specialist) {
        throw new Error("Specialist not found");
      }

      return { specialist };
    },
  });

  // Fetch appointment types for this specialist
  const { data: appointmentTypesData, isLoading: isLoadingAppointmentTypes } = useQuery({
    queryKey: ["specialist-appointment-types", specialistId],
    queryFn: async () => {
      const response = await adminClient.specialists[":id"]["appointment-types"].$get({
        param: { id: specialistId },
      });
      if (!response.ok) throw new Error("Failed to fetch appointment types");
      const data = await response.json();

      if ("error" in data) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Failed to fetch appointment types"
        );
      }

      return data.data || [];
    },
    enabled: !!specialistId,
  });

  const specialist = specialistData?.specialist as Specialist | undefined;

  // Memoize initial values to prevent recalculation
  const initialValues = useMemo(() => {
    if (!specialist) return null;

    let countryCode = "AU";
    if (specialist.location?.country) {
      const country = Country.getAllCountries().find(
        (c) => c.name === specialist.location?.country
      );
      countryCode = country?.isoCode || "AU";
    }

    const states = State.getStatesOfCountry(countryCode);
    let cities: any[] = [];
    if (specialist.location?.state && specialist.location?.country) {
      cities = City.getCitiesOfState(countryCode, specialist.location.state);
    }

    return {
      profileForm: {
        name: specialist.name,
        slug: specialist.slug,
        isActive: !!specialist.isActive,
        jobTitle: specialist.user.jobTitle,
      },
      practiceForm: {
        location: specialist.location || null,
      },
      countryCode,
      states,
      cities,
      showLocationFields: !!specialist.location,
    };
  }, [specialist?.id]);

  // Initialize form states
  const [profileForm, setProfileForm] = useState(
    initialValues?.profileForm || {
      name: "",
      slug: null,
      isActive: false,
      jobTitle: "",
    }
  );

  const [accountForm, setAccountForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
  });

  const [practiceForm, setPracticeForm] = useState(
    initialValues?.practiceForm || {
      location: null,
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

  const allCountries = Country.getAllCountries();

  // Debounced slug check
  const debouncedCheckSlugAvailability = useMemo(
    () =>
      debounce(async (slug: string, currentSlug: string) => {
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
          }
        } catch {
          setSlugAvailable(null);
        } finally {
          setCheckingSlug(false);
        }
      }, 500),
    []
  );

  // Fetch user data
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

  // Update forms when data changes
  useEffect(() => {
    if (initialValues) {
      setProfileForm(initialValues.profileForm);
      setPracticeForm(initialValues.practiceForm);
      setShowLocationFields(initialValues.showLocationFields);
      setSelectedCountryCode(initialValues.countryCode);
      setAvailableStates(initialValues.states);
      setAvailableCities(initialValues.cities);
    }
  }, [initialValues]);

  useEffect(() => {
    if (userData?.user) {
      setAccountForm({
        firstName: userData.user.firstName || "",
        lastName: userData.user.lastName || "",
        phone: userData.user.phoneNumber || "",
        email: userData.user.email || "",
      });
    } else if (specialist?.user) {
      setAccountForm({
        firstName: specialist.user.firstName || "",
        lastName: specialist.user.lastName || "",
        phone: "",
        email: specialist.user.email || "",
      });
    }
  }, [userData, specialist?.user]);

  // Location handlers
  const handleCountryChange = useCallback((countryCode: string) => {
    setSelectedCountryCode(countryCode);
    const states = State.getStatesOfCountry(countryCode);
    setAvailableStates(states);

    const country = Country.getCountryByCode(countryCode);
    setPracticeForm((prev) => ({
      location: {
        ...prev.location!,
        country: country?.name || "Australia",
        state: "",
        city: "",
      },
    }));
    setAvailableCities([]);
  }, []);

  const handleStateChange = useCallback(
    (stateCode: string) => {
      setPracticeForm((prev) => ({
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

  // Mutations
  const updateSpecialistMutation = useMutation({
    mutationFn: async (values: any) => {
      const response = await specialistsClient[":id"].$put({
        param: { id: specialistId },
        json: values,
      });

      if (!response.ok) {
        throw new Error(`Failed to update specialist`);
      }

      return response.json();
    },
    onSuccess: () => {
      toast.success("Updated successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-specialist", specialistId] });
      queryClient.invalidateQueries({ queryKey: ["specialists"] });
    },
    onError: () => {
      toast.error("Failed to update");
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async (values: any) => {
      const response = await adminClient.users[":id"].$put({
        param: { id: specialist!.userId },
        json: values,
      });
      if (!response.ok) throw new Error("Failed to update user");
      return response.json();
    },
    onSuccess: () => {
      toast.success("Updated successfully");
      refetchUser();
      queryClient.invalidateQueries({ queryKey: ["admin-specialist", specialistId] });
    },
    onError: () => {
      toast.error("Failed to update");
    },
  });

  // Save handlers
  const handleSaveProfile = () => {
    if (profileForm.slug && slugAvailable === false) {
      toast.error("The selected slug is not available");
      return;
    }

    updateSpecialistMutation.mutate(
      {
        name: profileForm.name,
        slug: profileForm.slug,
        isActive: profileForm.isActive,
      },
      {
        onSuccess: () => {
          setIsEditingProfile(false);
          // Also update job title
          if (profileForm.jobTitle !== specialist?.user.jobTitle) {
            updateUserMutation.mutate({ jobTitle: profileForm.jobTitle });
          }
        },
      }
    );
  };

  const handleSaveAccount = () => {
    updateUserMutation.mutate(
      {
        firstName: accountForm.firstName,
        lastName: accountForm.lastName,
        phone: accountForm.phone,
      },
      {
        onSuccess: () => setIsEditingAccount(false),
      }
    );
  };

  const handleSavePractice = () => {
    if (showLocationFields && practiceForm.location) {
      if (
        !practiceForm.location.city ||
        !practiceForm.location.state ||
        !practiceForm.location.country
      ) {
        toast.error("City, state, and country are required");
        return;
      }
    }

    updateSpecialistMutation.mutate(
      {
        location: showLocationFields ? practiceForm.location : null,
      },
      {
        onSuccess: () => setIsEditingPractice(false),
      }
    );
  };

  const handleImageUpload = async (imageBlob: Blob | null) => {
    setIsUploadingImage(true);
    try {
      let imageUrl: string | null = null;

      if (imageBlob) {
        const reader = new FileReader();
        imageUrl = await new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(imageBlob);
        });
      }

      await updateSpecialistMutation.mutateAsync({ image: imageUrl });
      toast.success(imageUrl ? "Image uploaded successfully" : "Image removed successfully");
    } catch (error) {
      toast.error("Failed to update image");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const user: ExtendedUser | null = userData?.user || null;

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
    <div className="min-h-screen bg-gray-50/50">
      <div className="mx-auto max-w-7xl p-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/admin" className="hover:text-foreground">
            Admin
          </Link>
          <ChevronRight className="w-4 h-4" />
          <Link href="/admin/users/specialists" className="hover:text-foreground">
            Specialists
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-foreground font-medium">{specialist.name}</span>
        </div>

        {/* Header Section */}
        <div className="mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/admin/users/specialists")}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Specialists
          </Button>

          <div className="bg-white rounded-lg border p-6 mb-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <SpecialistImageUpload
                  currentImageUrl={specialist.image}
                  userName={specialist.name}
                  onImageChange={handleImageUpload}
                  isUploading={isUploadingImage}
                />
                <div>
                  <h1 className="text-2xl font-semibold">{specialist.name}</h1>
                  <p className="text-muted-foreground">{specialist.user.jobTitle}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <Badge
                      variant={specialist.isActive ? "default" : "secondary"}
                      className={cn(
                        "font-medium",
                        specialist.isActive && "bg-green-500 hover:bg-green-600"
                      )}
                    >
                      <Activity className="w-3 h-3 mr-1" />
                      {specialist.isActive ? "Active" : "Inactive"}
                    </Badge>
                    {specialist.acceptsInPerson && (
                      <Badge variant="outline">
                        <MapPinned className="w-3 h-3 mr-1" />
                        In-Person
                      </Badge>
                    )}
                    {specialist.acceptsTelehealth && (
                      <Badge variant="outline">
                        <Video className="w-3 h-3 mr-1" />
                        Telehealth
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <div>Position #{specialist.position}</div>
                <div>
                  Updated {formatDistanceToNow(new Date(specialist.updatedAt), { addSuffix: true })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Sections */}
        <div className="space-y-6">
          {/* Row 1: Profile & Account */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Profile Settings */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserCircle className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-base">Profile Settings</CardTitle>
                    <CardDescription className="text-sm">
                      Public profile and display settings
                    </CardDescription>
                  </div>
                </div>
                {!isEditingProfile ? (
                  <Button variant="ghost" size="sm" onClick={() => setIsEditingProfile(true)}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsEditingProfile(false);
                        setProfileForm(initialValues?.profileForm || profileForm);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSaveProfile}>
                      Save
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {isEditingProfile ? (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm">Display Name</Label>
                      <Input
                        value={profileForm.name}
                        onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Professional Title</Label>
                      <Input
                        value={profileForm.jobTitle}
                        onChange={(e) =>
                          setProfileForm({ ...profileForm, jobTitle: e.target.value })
                        }
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Public URL</Label>
                      <div className="relative">
                        <Input
                          value={profileForm.slug || ""}
                          onChange={(e) => {
                            const newSlug = e.target.value || null;
                            setProfileForm({ ...profileForm, slug: newSlug });
                            if (newSlug) {
                              debouncedCheckSlugAvailability(newSlug, specialist.slug || "");
                            }
                          }}
                          placeholder="john-smith"
                          className={cn(
                            "mt-1",
                            slugAvailable === false && "border-red-500",
                            slugAvailable === true && "border-green-500"
                          )}
                        />
                        {checkingSlug && (
                          <Loader2 className="absolute right-3 top-3.5 h-4 w-4 animate-spin" />
                        )}
                      </div>
                      {slugAvailable !== null && (
                        <p
                          className={cn(
                            "text-xs mt-1",
                            slugAvailable ? "text-green-600" : "text-red-600"
                          )}
                        >
                          {slugAvailable ? "Available" : "Already taken"}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        medibytes.com.au/our-panel/{profileForm.slug || "slug"}
                      </p>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <Label className="text-sm">Active Status</Label>
                      <Switch
                        checked={profileForm.isActive}
                        onCheckedChange={(checked) =>
                          setProfileForm({ ...profileForm, isActive: checked })
                        }
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Display Name</p>
                      <p className="font-medium">{specialist.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Professional Title</p>
                      <p className="font-medium">{specialist.user.jobTitle || "Not specified"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Public URL</p>
                      {specialist.slug ? (
                        <Link
                          href={`https://medibytes.com.au/our-panel/${specialist.slug}`}
                          className="text-sm text-blue-600 hover:underline"
                          target="_blank"
                        >
                          medibytes.com.au/our-panel/{specialist.slug}
                        </Link>
                      ) : (
                        <p className="text-sm text-muted-foreground">Not configured</p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Account Details */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-base">Account Details</CardTitle>
                    <CardDescription className="text-sm">
                      Personal information and access
                    </CardDescription>
                  </div>
                </div>
                {!isEditingAccount ? (
                  <Button variant="ghost" size="sm" onClick={() => setIsEditingAccount(true)}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsEditingAccount(false);
                        if (userData?.user) {
                          setAccountForm({
                            firstName: userData.user.firstName || "",
                            lastName: userData.user.lastName || "",
                            phone: userData.user.phoneNumber || "",
                            email: userData.user.email || "",
                          });
                        }
                      }}
                    >
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSaveAccount}>
                      Save
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {isEditingAccount ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-sm">First Name</Label>
                        <Input
                          value={accountForm.firstName}
                          onChange={(e) =>
                            setAccountForm({ ...accountForm, firstName: e.target.value })
                          }
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-sm">Last Name</Label>
                        <Input
                          value={accountForm.lastName}
                          onChange={(e) =>
                            setAccountForm({ ...accountForm, lastName: e.target.value })
                          }
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm">Phone Number</Label>
                      <Input
                        value={accountForm.phone}
                        onChange={(e) => setAccountForm({ ...accountForm, phone: e.target.value })}
                        placeholder="+61 400 000 000"
                        className="mt-1"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Full Name</p>
                        <p className="font-medium">
                          {user?.firstName} {user?.lastName}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Organization Role</p>
                        {user?.memberships && user.memberships.length > 0 ? (
                          <Badge variant="secondary" className="text-xs">
                            {user.memberships[0].role}
                          </Badge>
                        ) : (
                          <p className="text-sm text-muted-foreground">No role assigned</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Email Address</p>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{user?.email}</p>
                        {user?.emailVerified && (
                          <Badge variant="outline" className="text-xs">
                            <Shield className="w-3 h-3 mr-1" />
                            Verified
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Phone Number</p>
                      <p className="font-medium">{user?.phoneNumber || "Not provided"}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Row 2: Practice Configuration & Scheduling */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Practice Configuration */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-base">Practice Configuration</CardTitle>
                    <CardDescription className="text-sm">Location settings</CardDescription>
                  </div>
                </div>
                {!isEditingPractice ? (
                  <Button variant="ghost" size="sm" onClick={() => setIsEditingPractice(true)}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsEditingPractice(false);
                        setPracticeForm(initialValues?.practiceForm || practiceForm);
                        setShowLocationFields(initialValues?.showLocationFields || false);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSavePractice}>
                      Save
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {isEditingPractice ? (
                  <div className="space-y-3">
                    {!showLocationFields ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowLocationFields(true);
                          setPracticeForm({
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
                        className="w-full"
                      >
                        <MapPin className="w-4 h-4 mr-2" />
                        Add Practice Location
                      </Button>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <Select value={selectedCountryCode} onValueChange={handleCountryChange}>
                            <SelectTrigger>
                              <SelectValue placeholder="Country" />
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
                            value={practiceForm.location?.state || ""}
                            onValueChange={handleStateChange}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="State" />
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
                            value={practiceForm.location?.city || ""}
                            onValueChange={(value) =>
                              setPracticeForm({
                                location: { ...practiceForm.location!, city: value },
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="City" />
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
                            value={practiceForm.location?.postalCode || ""}
                            onChange={(e) =>
                              setPracticeForm({
                                location: { ...practiceForm.location!, postalCode: e.target.value },
                              })
                            }
                          />
                        </div>
                        <Input
                          placeholder="Street Address (optional)"
                          value={practiceForm.location?.streetAddress || ""}
                          onChange={(e) =>
                            setPracticeForm({
                              location: {
                                ...practiceForm.location!,
                                streetAddress: e.target.value,
                              },
                            })
                          }
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setShowLocationFields(false);
                            setPracticeForm({ location: null });
                          }}
                          className="w-full"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Remove Location
                        </Button>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Practice Location</p>
                      <p className="font-medium">
                        {specialist.location
                          ? formatLocationShort(specialist.location)
                          : "Not configured"}
                      </p>
                      {specialist.location && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatLocationFull(specialist.location)}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Scheduling Integration */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-base">Scheduling Integration</CardTitle>
                    <CardDescription className="text-sm">
                      Acuity calendar configuration
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-muted/30 border border-gray-100 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Status</span>
                      <Badge className="bg-green-500 hover:bg-green-600">
                        <Activity className="w-3 h-3 mr-1" />
                        Connected
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Calendar ID</span>
                      <code className="font-mono text-xs bg-background px-2 py-1 rounded border">
                        {specialist.acuityCalendarId}
                      </code>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Created</span>
                      <span className="text-sm">
                        {format(new Date(specialist.createdAt), "PP")}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Appointment availability syncs automatically from Acuity
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Service Configuration */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-muted-foreground" />
                <div>
                  <CardTitle className="text-base">Service Configuration</CardTitle>
                  <CardDescription className="text-sm">
                    Appointment types and intake forms
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add/Edit Button */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {appointmentTypesData && appointmentTypesData.length > 0
                      ? `${appointmentTypesData.length} appointment type${appointmentTypesData.length === 1 ? "" : "s"} configured`
                      : "Configure appointment types for this specialist"}
                  </p>
                </div>
                <Button
                  onClick={() => setShowAppointmentTypesModal(true)}
                  variant="outline"
                  size="sm"
                >
                  <CalendarDays className="w-4 h-4 mr-2" />
                  {appointmentTypesData && appointmentTypesData.length > 0 ? "Manage" : "Add"}{" "}
                  appointment types
                </Button>
              </div>

              {/* Appointment Types List */}
              {isLoadingAppointmentTypes ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  <span className="text-sm text-muted-foreground">
                    Loading appointment types...
                  </span>
                </div>
              ) : appointmentTypesData && appointmentTypesData.length > 0 ? (
                <div className="space-y-2">
                  {appointmentTypesData.map((item: any) => (
                    <EditableAppointmentTypeCard
                      key={item.appointmentTypeId}
                      data={{
                        specialistId: specialistId,
                        appointmentTypeId: item.appointmentTypeId,
                        enabled: item.enabled,
                        appointmentMode: item.appointmentMode,
                        customDisplayName: item.customDisplayName,
                        customDescription: item.customDescription,
                        customPrice: item.customPrice,
                        notes: item.notes,
                        appointmentType: item.appointmentType,
                      }}
                      onUpdate={() => {
                        // Refetch appointment types after update
                        queryClient.invalidateQueries({
                          queryKey: ["specialist-appointment-types", specialistId],
                        });
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">No appointment types configured</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Appointment Types Modal */}
      {specialistData && (
        <AppointmentTypesModal
          open={showAppointmentTypesModal}
          onClose={() => setShowAppointmentTypesModal(false)}
          specialistId={specialistId}
          specialistName={specialistData.specialist.name}
          onSuccess={() => {
            // Refresh appointment types to update the list
            queryClient.invalidateQueries({
              queryKey: ["specialist-appointment-types", specialistId],
            });
            toast.success("Appointment types updated successfully");
          }}
        />
      )}
    </div>
  );
}
