import { google } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import { z } from "zod";
import { CATEGORIES } from "@/lib/categories";

// Gemini 1.5 Flash has been retired; 2.5 Flash is the cheap, fast vision
// default. Override with GEMINI_MODEL in .env.local.
const MODEL_ID = process.env.GEMINI_MODEL || "gemini-2.5-flash";

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

const INSTRUCTIONS = `You organize a user's screenshots.
Look at the image and return:
- ocr_text: every piece of readable text, transcribed faithfully. Do not summarize it.
- summary: exactly one plain sentence about what the screenshot is.
- category: the single best fit.
  Code = source code, terminals, IDEs, stack traces.
  Receipt = purchases, invoices, payment confirmations, bills.
  Schedule = calendars, timetables, event details, bookings.
  SocialMedia = posts, chats, comments, profiles from social apps.
  Meme = jokes and humorous images.
  Document = articles, notes, forms, slides, PDFs, emails.
  Other = anything else.
- tags: 2 or 3 short lowercase tags that would help find this later.`;

export async function analyzeScreenshot(
  image: Uint8Array,
  mediaType: string,
): Promise<ScreenshotAnalysis> {
  const { output } = await generateText({
    model: google(MODEL_ID),
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
