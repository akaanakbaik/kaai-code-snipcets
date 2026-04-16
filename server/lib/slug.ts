/**
 * Slug generator for code snippets.
 * Converts a title to a URL-friendly slug.
 * Handles Indonesian and English text.
 * Pure title-based — no random suffix appended.
 */

import { db } from "./db.js";
import { snippetsTable } from "./schema.js";
import { eq, and, ne, sql } from "drizzle-orm";

const INDONESIAN_CHARS: Record<string, string> = {
  "á": "a", "à": "a", "â": "a", "ä": "a", "ã": "a",
  "é": "e", "è": "e", "ê": "e", "ë": "e",
  "í": "i", "ì": "i", "î": "i", "ï": "i",
  "ó": "o", "ò": "o", "ô": "o", "ö": "o", "õ": "o",
  "ú": "u", "ù": "u", "û": "u", "ü": "u",
  "ñ": "n", "ç": "c",
};

/** Convert a title string to a URL-safe slug (no suffix). */
export function titleToSlug(title: string): string {
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

  return slug || "snippet";
}

/**
 * Generate a unique slug for a new snippet.
 * Checks existing slugs in DB and appends -2, -3, etc. if conflict.
 * @param title  - snippet title
 * @param excludeId - (optional) snippet ID to exclude from conflict check (for updates)
 */
export async function generateUniqueSlug(title: string, excludeId?: string): Promise<string> {
  const base = titleToSlug(title);

  // Find all existing slugs starting with the base slug
  const rows = await db
    .select({ slug: snippetsTable.slug })
    .from(snippetsTable)
    .where(
      excludeId
        ? and(
            sql`${snippetsTable.slug} = ${base} OR ${snippetsTable.slug} ~ ${"^" + base + "-[0-9]+$"}`,
            ne(snippetsTable.id, excludeId),
          )
        : sql`${snippetsTable.slug} = ${base} OR ${snippetsTable.slug} ~ ${"^" + base + "-[0-9]+$"}`,
    );

  if (rows.length === 0) return base;

  const existingSlugs = new Set(rows.map((r) => r.slug).filter(Boolean));

  // base slug taken — find next available number
  if (!existingSlugs.has(base)) return base;

  let n = 2;
  while (existingSlugs.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/** Legacy compat — synchronous slug from title (may have collision, use generateUniqueSlug for new snippets). */
export function generateSlug(title: string, _id?: string): string {
  return titleToSlug(title);
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) && slug.length >= 2 && slug.length <= 80;
}

/** Given a title, return what the slug would be (without DB check). */
export function previewSlug(title: string): string {
  return titleToSlug(title);
}
