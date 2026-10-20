import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Privacy Policy · Snapzy" };

export default function PrivacyPage() {
  return (
    <LegalPage
      note="what happens to your photos"
      title="Privacy Policy"
      updated="October 20, 2026"
      intro={
        <p>
          Snapzy is a personal tool for organizing your screenshots and pictures. This page
          explains, in plain words, what data it keeps, where it goes and how you can remove it.
        </p>
      }
      sections={[
        {
          heading: "What we store",
          body: (
            <>
              <p>
                Your account email and an encrypted password, managed by Supabase Auth. The
                photos you upload, stored in a private Supabase Storage bucket. For each photo:
                its file name, size, the text read from it, an AI-written summary, tags, its
                album and any structured details found (for example WiFi names, receipt totals
                or contact details).
              </p>
              <p>
                Your theme and language choices are saved only in your browser (localStorage).
              </p>
            </>
          ),
        },
        {
          heading: "How photos are analyzed",
          body: (
            <>
              <p>
                To read, caption and sort a photo, Snapzy sends the image to Google&apos;s Gemini
                API. Google processes it under its own terms for the Gemini API. QR codes are
                decoded on our server and are not sent anywhere extra for that step.
              </p>
              <p>
                Avoid uploading pictures you are not comfortable sending to an AI service, such
                as IDs or real passwords.
              </p>
            </>
          ),
        },
        {
          heading: "Who can see your data",
          body: (
            <p>
              Only you. Database rules (row-level security) limit every photo, album and tag to
              the account that created it, and files are reached only through short-lived signed
              links. Passwords found in photos are hidden on screen until you tap the eye
              button, but they are stored like the rest of the photo&apos;s text, not
              separately encrypted.
            </p>
          ),
        },
        {
          heading: "What we don't do",
          body: <p>We don&apos;t sell your data, show ads or share your photos with other users.</p>,
        },
        {
          heading: "Deleting your data",
          body: (
            <p>
              You can delete any photo from the gallery, or everything at once from Settings →
              Your data → Delete all photos. Deleted files are removed from storage right away.
              To delete the account itself, contact the person who runs your Snapzy instance.
            </p>
          ),
        },
      ]}
    />
  );
}
