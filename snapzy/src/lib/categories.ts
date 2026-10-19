// Order here is the order albums appear in.
export const CATEGORIES = [
  "Person",
  "Place",
  "Food",
  "Animal",
  "Product",
  "Logo",
  "QR",
  "Receipt",
  "Document",
  "Chat",
  "Code",
  "Meme",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export function isCategory(value: unknown): value is Category {
  return (CATEGORIES as readonly unknown[]).includes(value);
}

export type ProcessingStatus = "pending" | "processing" | "done" | "failed";

// A healthy analysis takes seconds, but bulk runs queue several at once.
// After this long in pending/processing we assume the job died and offer a retry.
export const STUCK_AFTER_MS = 10 * 60 * 1000;
