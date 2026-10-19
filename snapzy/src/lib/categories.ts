export const CATEGORIES = [
  "Code",
  "Receipt",
  "Schedule",
  "SocialMedia",
  "Meme",
  "Document",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export type ProcessingStatus = "pending" | "processing" | "done" | "failed";
