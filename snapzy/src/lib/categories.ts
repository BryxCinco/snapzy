// Client-safe category helpers. Categories live in the `categories` table
// (one list per user); see supabase/migrations/005_custom_categories.sql.

export type UserCategory = {
  id: string;
  name: string;
  color: CategoryColor;
  description: string | null;
  // The catch-all ("Other"): can't be deleted, AI and deletes fall back to it.
  isFallback: boolean;
};

export const CATEGORY_COLORS = [
  "pink",
  "rose",
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "fuchsia",
  "zinc",
] as const;

export type CategoryColor = (typeof CATEGORY_COLORS)[number];

export function toCategoryColor(value: unknown): CategoryColor {
  return (CATEGORY_COLORS as readonly unknown[]).includes(value)
    ? (value as CategoryColor)
    : "zinc";
}

// Full class strings (not built at runtime) so Tailwind can see them.
// `wash` tints album covers and empty states.
export const colorStyles: Record<CategoryColor, { badge: string; dot: string; wash: string }> = {
  pink: { badge: "bg-pink-50 text-pink-600 ring-pink-200 dark:bg-pink-500/15 dark:text-pink-300 dark:ring-pink-500/30", dot: "bg-pink-400", wash: "bg-pink-200" },
  rose: { badge: "bg-rose-50 text-rose-600 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30", dot: "bg-rose-400", wash: "bg-rose-200" },
  red: { badge: "bg-red-50 text-red-600 ring-red-200 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-500/30", dot: "bg-red-400", wash: "bg-red-200" },
  orange: { badge: "bg-orange-50 text-orange-600 ring-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:ring-orange-500/30", dot: "bg-orange-400", wash: "bg-orange-200" },
  amber: { badge: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30", dot: "bg-amber-400", wash: "bg-amber-200" },
  yellow: { badge: "bg-yellow-50 text-yellow-700 ring-yellow-200 dark:bg-yellow-500/15 dark:text-yellow-300 dark:ring-yellow-500/30", dot: "bg-yellow-400", wash: "bg-yellow-200" },
  lime: { badge: "bg-lime-50 text-lime-700 ring-lime-200 dark:bg-lime-500/15 dark:text-lime-300 dark:ring-lime-500/30", dot: "bg-lime-400", wash: "bg-lime-200" },
  emerald: { badge: "bg-emerald-50 text-emerald-600 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30", dot: "bg-emerald-400", wash: "bg-emerald-200" },
  teal: { badge: "bg-teal-50 text-teal-600 ring-teal-200 dark:bg-teal-500/15 dark:text-teal-300 dark:ring-teal-500/30", dot: "bg-teal-400", wash: "bg-teal-200" },
  cyan: { badge: "bg-cyan-50 text-cyan-600 ring-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-300 dark:ring-cyan-500/30", dot: "bg-cyan-400", wash: "bg-cyan-200" },
  sky: { badge: "bg-sky-50 text-sky-600 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30", dot: "bg-sky-400", wash: "bg-sky-200" },
  blue: { badge: "bg-blue-50 text-blue-600 ring-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-500/30", dot: "bg-blue-400", wash: "bg-blue-200" },
  indigo: { badge: "bg-indigo-50 text-indigo-600 ring-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-500/30", dot: "bg-indigo-400", wash: "bg-indigo-200" },
  violet: { badge: "bg-violet-50 text-violet-600 ring-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/30", dot: "bg-violet-400", wash: "bg-violet-200" },
  fuchsia: { badge: "bg-fuchsia-50 text-fuchsia-600 ring-fuchsia-200 dark:bg-fuchsia-500/15 dark:text-fuchsia-300 dark:ring-fuchsia-500/30", dot: "bg-fuchsia-400", wash: "bg-fuchsia-200" },
  zinc: { badge: "bg-zinc-50 text-zinc-600 ring-zinc-200 dark:bg-zinc-500/15 dark:text-zinc-300 dark:ring-zinc-500/30", dot: "bg-zinc-400", wash: "bg-zinc-200" },
};

export const MAX_CATEGORY_NAME = 40;
export const MAX_CATEGORY_DESCRIPTION = 200;
export const MAX_CATEGORIES = 50;
export const FALLBACK_CATEGORY_NAME = "Other";

// Seeded for every new user. Keep in sync with migration 005.
export const DEFAULT_CATEGORIES: {
  name: string;
  color: CategoryColor;
  description: string;
  isFallback?: boolean;
}[] = [
  { name: "People", color: "pink", description: "One or more people are the main subject: portraits, selfies, group photos." },
  { name: "Places", color: "amber", description: "Buildings, landmarks, rooms, streets, landscapes, nature, maps." },
  { name: "Food", color: "orange", description: "Dishes, drinks, ingredients, restaurant menus." },
  { name: "Animals", color: "lime", description: "Pets, wildlife, any animal as the main subject." },
  { name: "Products", color: "fuchsia", description: "Items for sale, shopping pages, gadgets, clothes, product photos." },
  { name: "Logos", color: "sky", description: "A brand mark, app icon, emblem or wordmark is the main subject." },
  { name: "QR codes", color: "emerald", description: "A QR code or barcode is the main subject." },
  { name: "Receipts", color: "teal", description: "Receipts, invoices, bills, payment or order confirmations." },
  { name: "Documents", color: "violet", description: "Articles, notes, forms, slides, emails, IDs, other text-heavy pages." },
  { name: "Chats & social", color: "blue", description: "Messaging apps, social media posts, comments, DMs." },
  { name: "Code", color: "cyan", description: "Source code, terminals, IDEs, error messages, stack traces." },
  { name: "Memes", color: "yellow", description: "Jokes and humorous images with captions." },
  { name: FALLBACK_CATEGORY_NAME, color: "zinc", description: "Anything that fits none of the other categories.", isFallback: true },
];

// "new" = uploaded but not analyzed yet (waits for "Sort photos").
export type ProcessingStatus = "new" | "pending" | "processing" | "done" | "failed";

// Marks a fallback "failed" row that really means "new" (before migration 008).
export const NOT_ANALYZED_YET = "Not analyzed yet.";

// Rough per-photo AI time, used for the "about N sec" estimate. Bulk runs
// process BULK_CONCURRENCY photos at once (see dashboard/actions.ts).
export const SECONDS_PER_PHOTO = 7;
export const BULK_CONCURRENCY = 3;

// A healthy analysis takes seconds, but bulk runs queue several at once.
// After this long in pending/processing we assume the job died and offer a retry.
export const STUCK_AFTER_MS = 10 * 60 * 1000;
