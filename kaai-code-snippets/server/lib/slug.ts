/**
 * Slug generator for code snippets.
 * Converts a title to a URL-friendly slug.
 * Handles Indonesian and English text.
 */

const INDONESIAN_CHARS: Record<string, string> = {
  "á": "a", "à": "a", "â": "a", "ä": "a", "ã": "a",
  "é": "e", "è": "e", "ê": "e", "ë": "e",
  "í": "i", "ì": "i", "î": "i", "ï": "i",
  "ó": "o", "ò": "o", "ô": "o", "ö": "o", "õ": "o",
  "ú": "u", "ù": "u", "û": "u", "ü": "u",
  "ñ": "n", "ç": "c",
};

export function generateSlug(title: string, id?: string): string {
  let slug = title.toLowerCase();

  // Replace accented characters
  slug = slug.replace(/[^\u0000-\u007E]/g, (char) => INDONESIAN_CHARS[char] || "");

  // Replace special chars with dash
  slug = slug
    .replace(/[^\w\s-]/g, " ")  // remove non-word chars (keep spaces and dash)
    .replace(/\s+/g, "-")        // replace whitespace with dash
    .replace(/-+/g, "-")         // collapse multiple dashes
    .replace(/^-|-$/g, "");      // trim leading/trailing dashes

  // Limit length to 60 chars (trim at word boundary)
  if (slug.length > 60) {
    slug = slug.substring(0, 60).replace(/-[^-]*$/, "");
  }

  // Append short ID suffix to guarantee uniqueness
  if (id) {
    const suffix = id.replace(/[^a-zA-Z0-9]/g, "").toLowerCase().slice(0, 6);
    slug = `${slug}-${suffix}`;
  }

  return slug || "snippet";
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) && slug.length >= 3 && slug.length <= 80;
}
