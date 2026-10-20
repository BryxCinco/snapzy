import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Terms and Conditions · Snapzy" };

export default function TermsPage() {
  return (
    <LegalPage
      note="the house rules"
      title="Terms and Conditions"
      updated="October 20, 2026"
      intro={
        <p>
          By creating an account or using Snapzy you agree to these terms. If you don&apos;t
          agree, please don&apos;t use the app.
        </p>
      }
      sections={[
        {
          heading: "Your account",
          body: (
            <p>
              Keep your login details safe; you are responsible for activity on your account.
              You must be old enough to agree to these terms where you live.
            </p>
          ),
        },
        {
          heading: "Your content",
          body: (
            <p>
              You keep ownership of everything you upload. You give Snapzy permission to store
              and process your photos only to provide the features you use, including sending
              them to an AI service for analysis. Only upload pictures you have the right to use.
            </p>
          ),
        },
        {
          heading: "Acceptable use",
          body: (
            <p>
              Don&apos;t upload illegal content, don&apos;t try to access other people&apos;s
              data, and don&apos;t overload or attack the service.
            </p>
          ),
        },
        {
          heading: "AI results",
          body: (
            <p>
              Captions, categories, extracted text and smart details are generated
              automatically and can be wrong. Double-check anything important, such as amounts,
              reference numbers or flight times, against the original image.
            </p>
          ),
        },
        {
          heading: "Availability",
          body: (
            <p>
              Snapzy is provided “as is”, without guarantees that it will always be available or
              error-free. Keep your own copies of photos that matter; you can download them
              individually or as a ZIP at any time.
            </p>
          ),
        },
        {
          heading: "Changes",
          body: (
            <p>
              These terms may change as the app grows. The date at the top shows the latest
              version; continuing to use Snapzy means you accept the updated terms.
            </p>
          ),
        },
      ]}
    />
  );
}
