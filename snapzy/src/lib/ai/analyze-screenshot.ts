import { google } from "@ai-sdk/google";
import { APICallError, generateText, Output, RetryError } from "ai";
import { z } from "zod";
import { parseMetadata, type ScreenshotMetadata } from "@/lib/metadata";
import { decodeQrCode, parseWifiQr } from "@/lib/qr-decode";

// Older Flash models (1.5, 2.5) are closed to new API keys; Google's error
// response points new users to 3.8 Flash. Override with GEMINI_MODEL.
// 3.5 Flash is the fallback when the primary model is overloaded (503) or
// unavailable to this key.
const MODEL_IDS = [
  ...new Set([
    process.env.GEMINI_MODEL || "gemini-3.8-flash",
    "gemini-3.5-flash",
    // Separate (larger) free-tier quota: keeps uploads working after the
    // Flash daily limit runs out.
    "gemini-3.5-flash-lite",
  ]),
];

// Worth trying the next model: overloaded, rate-limited or model not offered.
function shouldFallBack(err: unknown): boolean {
  const cause = RetryError.isInstance(err) ? err.lastError : err;
  return (
    APICallError.isInstance(cause) &&
    [404, 429, 500, 503].includes(cause.statusCode ?? 0)
  );
}

export type CategoryOption = {
  name: string;
  description: string | null;
};

export type ScreenshotAnalysis = {
  ocr_text: string;
  summary: string;
  // One of the names passed in `categories`.
  category: string;
  tags: string[];
  // Structured data found in the image; null when there's none.
  metadata: ScreenshotMetadata | null;
};

const text = (description: string) => z.string().nullable().describe(description);

// Every field is nullable: the model fills only what is clearly visible.
const extractedSchema = z.object({
  wifi: z
    .object({
      ssid: z.string().describe("Network name exactly as shown."),
      password: text("Password exactly as shown, case-sensitive."),
      security: text("WPA, WPA2, WPA3, WEP or open, if shown."),
    })
    .nullable()
    .describe("Only when the image shows a WiFi network name, e.g. a router sticker, a WiFi QR code, or a sign."),
  flight: z
    .object({
      flight_number: text("e.g. PR 102, 5J 560."),
      airline: text("Airline name."),
      passenger: text("Passenger name."),
      from: text("Origin airport code or city."),
      to: text("Destination airport code or city."),
      date: text("Departure date as shown."),
      departure_time: text("Departure or boarding time as shown."),
      gate: text("Gate."),
      seat: text("Seat."),
      booking_reference: text("Booking reference / PNR."),
    })
    .nullable()
    .describe("Only for boarding passes, flight bookings or itineraries."),
  payment: z
    .object({
      provider: text("e.g. GCash, Maya, BDO, PayPal."),
      amount: text("Amount sent or received, digits as shown, without the currency sign."),
      currency: text("ISO code, e.g. PHP, USD."),
      reference_number: text("Reference / transaction number."),
      recipient: text("Who was paid."),
      date: text("Transaction date and time as shown."),
    })
    .nullable()
    .describe("Only for money transfers and payment confirmations: GCash, Maya, InstaPay, bank apps."),
  receipt: z
    .object({
      merchant: text("Store or restaurant name."),
      total: text("Grand total, digits as shown, without the currency sign."),
      currency: text("ISO code, e.g. PHP, USD."),
      date: text("Date and time as shown."),
      receipt_number: text("Receipt, invoice or OR number."),
      items: z
        .array(
          z.object({
            name: z.string(),
            quantity: text("Quantity, if shown."),
            price: text("Line price, digits as shown."),
          }),
        )
        .describe("Line items, at most 20. Empty array if not itemized."),
    })
    .nullable()
    .describe("Only for store / restaurant receipts and invoices."),
  credentials: z
    .array(
      z.object({
        service: text("Website, app or account the login is for."),
        username: text("Username, email or account ID."),
        password: text("Password exactly as shown, case-sensitive."),
      }),
    )
    .describe("Login details written in the image, e.g. a note with an account and password. Empty array if none."),
  emails: z.array(z.string()).describe("Email addresses visible in the image."),
  phones: z.array(z.string()).describe("Phone numbers exactly as shown, e.g. 0917 123 4567, +63 2 8123 4567."),
  socials: z
    .array(
      z.object({
        platform: z.string().describe("e.g. Facebook, Instagram, TikTok, X, YouTube, Discord."),
        handle: text("@handle or username."),
        url: text("Profile URL, if shown."),
      }),
    )
    .describe("Social media accounts shown, e.g. on a profile page, business card or poster."),
  names: z
    .array(z.string())
    .describe("Full names of people written in the image (contacts, senders, ID holders). Not brand names."),
  links: z.array(z.string()).describe("Website URLs shown in the image."),
  addresses: z.array(z.string()).describe("Street / mailing addresses shown in the image."),
  codes: z
    .array(
      z.object({
        kind: z.enum(["qr", "barcode"]),
        value: z
          .string()
          .describe("For a barcode: the digits printed under it. For a QR code: only text printed next to it, never a guess."),
      }),
    )
    .describe("QR codes and barcodes in the image whose value is readable as printed text."),
});

function buildSchema(categoryNames: [string, ...string[]]) {
  return z.object({
    extracted: extractedSchema,
    ocr_text: z
      .string()
      .describe("All readable text in the image, in reading order. Empty string if none."),
    summary: z
      .string()
      .describe("One sentence describing what the image shows."),
    category: z.enum(categoryNames),
    tags: z
      .array(z.string())
      .describe("2-3 short, lowercase topical tags, e.g. 'python', 'grocery'."),
  });
}

// The user's own category list goes into the prompt, so custom ones like
// "Mobile Legends" or "Wifi" work without code changes.
function buildInstructions(categories: CategoryOption[], fallbackName: string) {
  const list = categories
    .map((c) => (c.description ? `  - ${c.name}: ${c.description}` : `  - ${c.name}`))
    .join("\n");

  return `You organize a user's screenshots and pictures.
Look at the image and return:
- ocr_text: every piece of readable text, transcribed faithfully. Do not summarize it.
- summary: exactly one plain sentence about what the image shows.
- category: choose the best category from this list, using the exact name:
${list}
  Judge by the main subject of the image and prefer the most specific category.
  Categories the user created themselves (often games, hobbies, topics) take
  priority over general ones when they clearly match.
  If no category fits, choose "${fallbackName}".
- tags: 2 or 3 short lowercase tags that would help find this later.
- extracted: structured details, only when they are clearly visible:
  wifi (network name, password); flight (boarding pass / booking details);
  payment (GCash, Maya, bank transfers: amount, reference number);
  receipt (store receipts: merchant, items, total); credentials (written
  logins and passwords); emails; phones; socials (platform + handle);
  names (people's names); links; addresses; codes (barcode digits, QR text).
  Copy values exactly as shown. Never guess or invent a value: use null for
  anything not visible, null for a section that doesn't apply, and an empty
  array when a list has nothing.`;
}

export async function analyzeScreenshot(
  image: Uint8Array,
  mediaType: string,
  categories: CategoryOption[],
  fallbackName: string,
): Promise<ScreenshotAnalysis> {
  const names = [...new Set([...categories.map((c) => c.name), fallbackName])] as [
    string,
    ...string[],
  ];
  // The QR decoder runs alongside the AI call; it's local and fast.
  const [output, qrPayload] = await Promise.all([
    generateWithFallback(
      image,
      mediaType,
      buildSchema(names),
      buildInstructions(categories, fallbackName),
    ),
    decodeQrCode(image),
  ]);

  const tags = [
    ...new Set(
      output.tags
        .map((t) => t.trim().toLowerCase().replace(/^#/, ""))
        .filter((t) => t.length > 0 && t.length <= 40),
    ),
  ].slice(0, 3);

  return {
    ocr_text: output.ocr_text.trim(),
    summary: output.summary.trim(),
    category: output.category,
    tags,
    metadata: mergeQr(parseMetadata(output.extracted), qrPayload),
  };
}

// A decoded QR payload is exact, so it replaces whatever QR value the model
// read as text. A WiFi QR also fills the WiFi card.
function mergeQr(
  metadata: ScreenshotMetadata | null,
  qrPayload: string | null,
): ScreenshotMetadata | null {
  if (!qrPayload) return metadata;
  const merged: ScreenshotMetadata = { ...metadata };
  const barcodes = (merged.codes ?? []).filter((c) => c.kind === "barcode");
  merged.codes = [{ kind: "qr", value: qrPayload, source: "qr-decoder" }, ...barcodes];

  const wifi = parseWifiQr(qrPayload);
  if (wifi) merged.wifi = wifi;
  else if (/^https?:\/\//i.test(qrPayload) && !merged.links?.includes(qrPayload)) {
    merged.links = [...(merged.links ?? []), qrPayload];
  }
  return merged;
}

async function generateWithFallback(
  image: Uint8Array,
  mediaType: string,
  schema: ReturnType<typeof buildSchema>,
  instructions: string,
) {
  let lastError: unknown;
  for (const modelId of MODEL_IDS) {
    try {
      const { output } = await generateText({
        model: google(modelId),
        instructions,
        output: Output.object({ schema }),
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Analyze this screenshot." },
              { type: "file", mediaType, data: image },
            ],
          },
        ],
      });
      return output;
    } catch (err) {
      lastError = err;
      if (!shouldFallBack(err)) throw err;
      console.warn(`[snapzy] ${modelId} unavailable, trying next model.`);
    }
  }
  throw lastError;
}
