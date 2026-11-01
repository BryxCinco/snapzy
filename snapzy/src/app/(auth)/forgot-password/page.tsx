import type { Metadata } from "next";
import { ForgotPasswordForm } from "../simple-forms";

export const metadata: Metadata = { title: "Forgot password · Snapzy" };

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
