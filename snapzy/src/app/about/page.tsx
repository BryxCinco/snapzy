import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "About · Snapzy" };

export default function AboutPage() {
  return (
    <LegalPage
      note="hello from the gallery ✿"
      title="About Snapzy"
      intro={
        <p>
          Snapzy is an AI-powered screenshot sorter and picture organizer. It turns the pile of
          screenshots in your camera roll into a small gallery you can actually search.
        </p>
      }
      sections={[
        {
          heading: "What it does",
          body: (
            <p>
              Every photo you add is read (OCR), captioned and hung in an album, with your own
              custom albums taking priority. Smart cards pull out the useful bits: WiFi
              passwords, receipt totals, GCash reference numbers, flight details, contacts, QR
              codes and more.
            </p>
          ),
        },
        {
          heading: "How it's built",
          body: (
            <p>
              Next.js and TypeScript with Tailwind CSS, Supabase for accounts, the database and
              private file storage, and Google Gemini for image understanding.
            </p>
          ),
        },
        {
          heading: "Version",
          body: <p>0.1.0</p>,
        },
      ]}
    />
  );
}
