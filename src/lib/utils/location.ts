import type { SpecialistLocation } from "@/types/specialist";
import { State } from "country-state-city";

/**
 * Get state name from ISO code (e.g., "QLD" -> "Queensland")
 */
export function getStateName(stateCode: string, countryCode: string = "AU"): string {
  const state = State.getStateByCodeAndCountry(stateCode, countryCode);
  return state?.name || stateCode;
}

/**
 * Format location for short display (e.g., "Brisbane, QLD")
 * Assumes state is already stored as ISO code
 */
export function formatLocationShort(location: SpecialistLocation | null): string | null {
  if (!location) return null;

  const parts = [];
  if (location.city) parts.push(location.city);
  if (location.state) parts.push(location.state); // State should already be stored as code (QLD, NSW, etc.)

  return parts.length > 0 ? parts.join(", ") : null;
}

/**
 * Format location for full display (e.g., "123 Main St, Brisbane, QLD 4000")
 */
export function formatLocationFull(location: SpecialistLocation | null): string | null {
  if (!location) return null;

  const parts = [];
  if (location.streetAddress) parts.push(location.streetAddress);
  if (location.suburb) parts.push(location.suburb);
  if (location.city) parts.push(location.city);
  if (location.state) parts.push(location.state);
  if (location.postalCode) parts.push(location.postalCode);
  if (location.country && location.country !== "Australia") {
    parts.push(location.country);
  }

  return parts.length > 0 ? parts.join(", ") : null;
}

/**
 * Format location for city display (e.g., "Brisbane")
 */
export function formatLocationCity(location: SpecialistLocation | null): string | null {
  if (!location) return null;
  return location.city || null;
}

/**
 * Get location display text based on specialist settings
 */
export function getLocationDisplay(
  acceptsInPerson: boolean,
  acceptsTelehealth: boolean,
  location: SpecialistLocation | null,
  format: "short" | "full" = "short"
): string {
  // Availability on request - neither appointment type selected
  if (!acceptsInPerson && !acceptsTelehealth) {
    return "Availability on Request";
  }

  if (!acceptsInPerson && acceptsTelehealth) {
    return "Online Meeting Room";
  }

  if (acceptsInPerson && !location) {
    return "Location TBD";
  }

  if (acceptsInPerson && location) {
    const formatted =
      format === "full" ? formatLocationFull(location) : formatLocationShort(location);
    return formatted || "Location incomplete";
  }

  return "Not specified";
}

/**
 * Validate if location has all required fields
 */
export function isLocationValid(location: SpecialistLocation | null): boolean {
  if (!location) return false;
  return !!(location.city && location.state && location.country);
}

/**
 * Get appointment type display text
 */
export function getAppointmentTypeDisplay(
  acceptsInPerson: boolean,
  acceptsTelehealth: boolean
): string {
  if (acceptsInPerson && acceptsTelehealth) {
    return "In-person & Telehealth";
  }
  if (acceptsInPerson) {
    return "In-person only";
  }
  if (acceptsTelehealth) {
    return "Telehealth only";
  }
  return "Availability on Request";
}
