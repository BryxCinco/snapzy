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
export const colorStyles: Record<CategoryColor, { badge: string; dot: string }> = {
  pink: { badge: "bg-pink-500/15 text-pink-300 ring-pink-500/30", dot: "bg-pink-400" },
  rose: { badge: "bg-rose-500/15 text-rose-300 ring-rose-500/30", dot: "bg-rose-400" },
  red: { badge: "bg-red-500/15 text-red-300 ring-red-500/30", dot: "bg-red-400" },
  orange: { badge: "bg-orange-500/15 text-orange-300 ring-orange-500/30", dot: "bg-orange-400" },
  amber: { badge: "bg-amber-500/15 text-amber-300 ring-amber-500/30", dot: "bg-amber-400" },
  yellow: { badge: "bg-yellow-500/15 text-yellow-300 ring-yellow-500/30", dot: "bg-yellow-400" },
  lime: { badge: "bg-lime-500/15 text-lime-300 ring-lime-500/30", dot: "bg-lime-400" },
  emerald: { badge: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30", dot: "bg-emerald-400" },
  teal: { badge: "bg-teal-500/15 text-teal-300 ring-teal-500/30", dot: "bg-teal-400" },
  cyan: { badge: "bg-cyan-500/15 text-cyan-300 ring-cyan-500/30", dot: "bg-cyan-400" },
  sky: { badge: "bg-sky-500/15 text-sky-300 ring-sky-500/30", dot: "bg-sky-400" },
  blue: { badge: "bg-blue-500/15 text-blue-300 ring-blue-500/30", dot: "bg-blue-400" },
  indigo: { badge: "bg-indigo-500/15 text-indigo-300 ring-indigo-500/30", dot: "bg-indigo-400" },
  violet: { badge: "bg-violet-500/15 text-violet-300 ring-violet-500/30", dot: "bg-violet-400" },
  fuchsia: { badge: "bg-fuchsia-500/15 text-fuchsia-300 ring-fuchsia-500/30", dot: "bg-fuchsia-400" },
  zinc: { badge: "bg-zinc-500/15 text-zinc-300 ring-zinc-500/30", dot: "bg-zinc-400" },
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

export type ProcessingStatus = "pending" | "processing" | "done" | "failed";

// A healthy analysis takes seconds, but bulk runs queue several at once.
// After this long in pending/processing we assume the job died and offer a retry.
export const STUCK_AFTER_MS = 10 * 60 * 1000;
