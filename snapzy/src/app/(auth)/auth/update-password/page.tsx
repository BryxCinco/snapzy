import type { Metadata } from "next";
import { UpdatePasswordForm } from "../../simple-forms";

export const metadata: Metadata = { title: "New password · Snapzy" };

// The proxy only lets signed-in users reach this page; the reset link signs
// them in through /auth/callback first.
export default function UpdatePasswordPage() {
  return <UpdatePasswordForm />;
}
