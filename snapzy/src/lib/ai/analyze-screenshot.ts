import { google } from "@ai-sdk/google";
import { APICallError, generateText, Output, RetryError } from "ai";
import { z } from "zod";
import { CATEGORIES } from "@/lib/categories";

// Older Flash models (1.5, 2.5) are closed to new API keys; Google's error
// response points new users to 3.8 Flash. Override with GEMINI_MODEL.
// 3.5 Flash is the fallback when the primary model is overloaded (503) or
// unavailable to this key.
const MODEL_IDS = [
  ...new Set([process.env.GEMINI_MODEL || "gemini-3.8-flash", "gemini-3.5-flash"]),
];

// Worth trying the next model: overloaded, rate-limited or model not offered.
function shouldFallBack(err: unknown): boolean {
  const cause = RetryError.isInstance(err) ? err.lastError : err;
  return (
    APICallError.isInstance(cause) &&
    [404, 429, 500, 503].includes(cause.statusCode ?? 0)
  );
}

const analysisSchema = z.object({
  ocr_text: z
    .string()
    .describe("All readable text in the image, in reading order. Empty string if none."),
  summary: z
    .string()
    .describe("One sentence describing what the screenshot shows."),
  category: z.enum(CATEGORIES),
  tags: z
    .array(z.string())
    .describe("2-3 short, lowercase topical tags, e.g. 'python', 'grocery'."),
});

export type ScreenshotAnalysis = z.infer<typeof analysisSchema>;

const INSTRUCTIONS = `You organize a user's screenshots and pictures.
Look at the image and return:
- ocr_text: every piece of readable text, transcribed faithfully. Do not summarize it.
- summary: exactly one plain sentence about what the image shows.
- category: the single best fit, judged by the main subject of the image.
  Person = one or more people are the main subject (portraits, selfies, group photos).
  Place = buildings, landmarks, rooms, streets, landscapes, nature, maps.
  Food = dishes, drinks, ingredients, restaurant menus.
  Animal = pets, wildlife, any animal as the main subject.
  Product = items for sale, shopping pages, gadgets, clothes, product photos.
  Logo = a brand mark, app icon, emblem or wordmark is the main subject.
  QR = a QR code or barcode is the main subject.
  Receipt = receipts, invoices, bills, payment or order confirmations.
  Document = articles, notes, forms, slides, emails, IDs, other text-heavy pages.
  Chat = messaging apps, social media posts, comments, DMs.
  Code = source code, terminals, IDEs, error messages, stack traces.
  Meme = jokes and humorous images with captions.
  Other = anything that fits none of the above.
  Prefer the most specific category: a receipt is Receipt, not Document;
  a chat screenshot is Chat, not Document. Choose QR only when the code dominates the image.
- tags: 2 or 3 short lowercase tags that would help find this later.`;

export async function analyzeScreenshot(
  image: Uint8Array,
  mediaType: string,
): Promise<ScreenshotAnalysis> {
  const output = await generateWithFallback(image, mediaType);

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
  };
}

async function generateWithFallback(image: Uint8Array, mediaType: string) {
  let lastError: unknown;
  for (const modelId of MODEL_IDS) {
    try {
      const { output } = await generateText({
        model: google(modelId),
        instructions: INSTRUCTIONS,
        output: Output.object({ schema: analysisSchema }),
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
