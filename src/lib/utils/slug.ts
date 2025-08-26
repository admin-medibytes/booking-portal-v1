/**
 * Generate a URL-safe slug from a text string
 * @param text - The text to convert to a slug
 * @returns A lowercase slug with special characters replaced by hyphens
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric characters with hyphens
    .replace(/^-+|-+$/g, ""); // Remove leading and trailing hyphens
}