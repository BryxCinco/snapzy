// Structured data the AI extracts from an image (screenshots.metadata).
// Client-safe; shared by the AI step, the gallery and the detail modal.

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

export type PaymentInfo = {
  provider: string | null;
  amount: string | null;
  currency: string | null;
  reference_number: string | null;
  recipient: string | null;
  date: string | null;
};

export type ScreenshotMetadata = {
  wifi?: WifiInfo;
  flight?: FlightInfo;
  payment?: PaymentInfo;
};

type Loose = Record<string, unknown>;

function str(value: unknown): string | null {
  if (typeof value === "number") return String(value);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && trimmed.toLowerCase() !== "null" ? trimmed.slice(0, 200) : null;
}

function pick<K extends string>(raw: unknown, keys: readonly K[]) {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Loose;
  return Object.fromEntries(keys.map((k) => [k, str(obj[k])])) as Record<K, string | null>;
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

/**
 * Normalizes whatever is in the DB (or came back from the AI) into the
 * shape above, dropping empty sections. Returns null if nothing useful.
 */
export function parseMetadata(raw: unknown): ScreenshotMetadata | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Loose;
  const out: ScreenshotMetadata = {};

  const wifi = pick(obj.wifi, ["ssid", "password", "security"] as const);
  if (wifi.ssid) out.wifi = { ssid: wifi.ssid, password: wifi.password, security: wifi.security };

  const flight = pick(obj.flight, FLIGHT_KEYS);
  // A flight card needs at least a flight number or a route to be useful.
  if (flight.flight_number || (flight.from && flight.to)) out.flight = flight;

  const payment = pick(obj.payment, PAYMENT_KEYS);
  if (payment.amount || payment.reference_number) out.payment = payment;

  return Object.keys(out).length > 0 ? out : null;
}
