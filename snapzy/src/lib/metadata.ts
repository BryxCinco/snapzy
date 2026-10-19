// Structured data the AI (and the QR decoder) extract from an image,
// stored in screenshots.metadata. Client-safe; shared by the AI step, the
// gallery and the detail modal.

export type WifiInfo = {
  ssid: string;
  password: string | null;
  security: string | null;
};

export type FlightInfo = {
  flight_number: string | null;
  airline: string | null;
  passenger: string | null;
  from: string | null;
  to: string | null;
  date: string | null;
  departure_time: string | null;
  gate: string | null;
  seat: string | null;
  booking_reference: string | null;
};

// Money sent or received: GCash, Maya, bank transfers.
export type PaymentInfo = {
  provider: string | null;
  amount: string | null;
  currency: string | null;
  reference_number: string | null;
  recipient: string | null;
  date: string | null;
};

export type ReceiptItem = {
  name: string;
  quantity: string | null;
  price: string | null;
};

// A store / restaurant receipt or invoice.
export type ReceiptInfo = {
  merchant: string | null;
  total: string | null;
  currency: string | null;
  date: string | null;
  receipt_number: string | null;
  items: ReceiptItem[];
};

// A login / account details visible in the image.
export type Credential = {
  service: string | null;
  username: string | null;
  password: string | null;
};

export type SocialHandle = {
  platform: string;
  handle: string | null;
  url: string | null;
};

export type CodeInfo = {
  kind: "qr" | "barcode";
  // Decoded QR payload, or the digits printed under a barcode.
  value: string;
  // "qr-decoder" = read from the pixels (exact); "ai" = read as text by the model.
  source: "qr-decoder" | "ai";
};

export type ScreenshotMetadata = {
  wifi?: WifiInfo;
  flight?: FlightInfo;
  payment?: PaymentInfo;
  receipt?: ReceiptInfo;
  credentials?: Credential[];
  emails?: string[];
  phones?: string[];
  socials?: SocialHandle[];
  names?: string[];
  links?: string[];
  addresses?: string[];
  codes?: CodeInfo[];
};

type Loose = Record<string, unknown>;

const MAX_LIST = 20;

function str(value: unknown, max = 300): string | null {
  if (typeof value === "number") return String(value);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || ["null", "n/a", "none"].includes(trimmed.toLowerCase())) return null;
  return trimmed.slice(0, max);
}

function obj(value: unknown): Loose {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Loose) : {};
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value.slice(0, MAX_LIST) : [];
}

function pick<K extends string>(raw: unknown, keys: readonly K[]) {
  const o = obj(raw);
  return Object.fromEntries(keys.map((k) => [k, str(o[k])])) as Record<K, string | null>;
}

// Unique, non-empty strings (case-insensitive dedupe).
function strings(value: unknown, normalize: (s: string) => string = (s) => s) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list(value)) {
    const s = str(item);
    if (!s) continue;
    const n = normalize(s);
    if (seen.has(n.toLowerCase())) continue;
    seen.add(n.toLowerCase());
    out.push(n);
  }
  return out;
}

const FLIGHT_KEYS = [
  "flight_number",
  "airline",
  "passenger",
  "from",
  "to",
  "date",
  "departure_time",
  "gate",
  "seat",
  "booking_reference",
] as const;

const PAYMENT_KEYS = [
  "provider",
  "amount",
  "currency",
  "reference_number",
  "recipient",
  "date",
] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Normalizes whatever is in the DB (or came back from the AI) into the
 * shape above, dropping empty sections. Returns null if nothing useful.
 */
export function parseMetadata(raw: unknown): ScreenshotMetadata | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Loose;
  const out: ScreenshotMetadata = {};

  const wifi = pick(o.wifi, ["ssid", "password", "security"] as const);
  if (wifi.ssid) out.wifi = { ssid: wifi.ssid, password: wifi.password, security: wifi.security };

  const flight = pick(o.flight, FLIGHT_KEYS);
  // A flight card needs at least a flight number or a route to be useful.
  if (flight.flight_number || (flight.from && flight.to)) out.flight = flight;

  const payment = pick(o.payment, PAYMENT_KEYS);
  if (payment.amount || payment.reference_number) out.payment = payment;

  const r = obj(o.receipt);
  const receipt: ReceiptInfo = {
    ...pick(r, ["merchant", "total", "currency", "date", "receipt_number"] as const),
    items: list(r.items).flatMap((item) => {
      const i = pick(item, ["name", "quantity", "price"] as const);
      return i.name ? [{ name: i.name, quantity: i.quantity, price: i.price }] : [];
    }),
  };
  if (receipt.total || receipt.items.length > 0) out.receipt = receipt;

  const credentials = list(o.credentials).flatMap((c) => {
    const v = pick(c, ["service", "username", "password"] as const);
    return v.username || v.password ? [v] : [];
  });
  if (credentials.length) out.credentials = credentials;

  const emails = strings(o.emails, (s) => s.toLowerCase()).filter((e) => EMAIL_RE.test(e));
  if (emails.length) out.emails = emails;

  const phones = strings(o.phones).filter((p) => p.replace(/\D/g, "").length >= 7);
  if (phones.length) out.phones = phones;

  const socials = list(o.socials).flatMap((s) => {
    const v = pick(s, ["platform", "handle", "url"] as const);
    return v.platform && (v.handle || v.url)
      ? [{ platform: v.platform, handle: v.handle, url: v.url }]
      : [];
  });
  if (socials.length) out.socials = socials;

  const names = strings(o.names);
  if (names.length) out.names = names;

  const links = strings(o.links);
  if (links.length) out.links = links;

  const addresses = strings(o.addresses);
  if (addresses.length) out.addresses = addresses;

  const seenCodes = new Set<string>();
  const codes = list(o.codes).flatMap((c): CodeInfo[] => {
    const v = obj(c);
    const value = str(v.value, 2000);
    const kind = v.kind === "barcode" ? "barcode" : v.kind === "qr" ? "qr" : null;
    if (!value || !kind || seenCodes.has(value)) return [];
    seenCodes.add(value);
    return [{ kind, value, source: v.source === "qr-decoder" ? "qr-decoder" : "ai" }];
  });
  if (codes.length) out.codes = codes;

  return Object.keys(out).length > 0 ? out : null;
}

/** Short labels for the gallery card badges. */
export function metadataLabels(m: ScreenshotMetadata | null): string[] {
  if (!m) return [];
  const labels: string[] = [];
  if (m.wifi) labels.push("WiFi");
  if (m.flight) labels.push("Flight");
  if (m.payment) labels.push("Payment");
  if (m.receipt) labels.push("Receipt");
  if (m.credentials) labels.push("Login");
  if (m.codes?.some((c) => c.kind === "qr")) labels.push("QR");
  if (m.codes?.some((c) => c.kind === "barcode")) labels.push("Barcode");
  if (m.emails || m.phones || m.socials || m.addresses) labels.push("Contact");
  return labels;
}

/** Passwords / PINs the AI found, so the UI can hide them wherever they appear. */
export function secretsOf(m: ScreenshotMetadata | null): string[] {
  if (!m) return [];
  const secrets = [m.wifi?.password, ...(m.credentials?.map((c) => c.password) ?? [])];
  // Very short values ("1", "ok") would mask ordinary words.
  return [...new Set(secrets.filter((s): s is string => Boolean(s && s.length >= 3)))];
}

const MASK = "••••••";

/** Replaces every occurrence of each secret in `text` with a mask. */
export function maskSecrets(text: string, secrets: string[]): string {
  if (secrets.length === 0) return text;
  // Longest first, so "pass123" is masked before "pass".
  const pattern = [...secrets]
    .sort((a, b) => b.length - a.length)
    .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  // Not inside a longer word: a password "pass" shouldn't turn "password"
  // into "••••••word". (\b doesn't work, passwords often contain symbols.)
  return text.replace(
    new RegExp(`(?<![\\p{L}\\p{N}])(?:${pattern})(?![\\p{L}\\p{N}])`, "gu"),
    MASK,
  );
}
