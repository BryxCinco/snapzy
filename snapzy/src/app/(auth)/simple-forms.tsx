"use client";

import Link from "next/link";
import { useActionState } from "react";
import { PasswordInput } from "@/components/password-input";
import { Logo } from "@/components/watercolor";
import { requestPasswordReset, updatePassword, type AuthState } from "./actions";
import { Field, INPUT } from "./auth-form";

const SUBMIT =
  "mt-2 w-full rounded-full bg-brand px-4 py-3.5 text-sm font-semibold tracking-wide text-white uppercase shadow-lift transition hover:-translate-y-0.5 hover:bg-brand-deep disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60";

function Shell({
  note,
  title,
  subtitle,
  children,
}: {
  note: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full max-w-sm animate-rise">
      <div className="mb-8 flex justify-center lg:hidden">
        <Logo />
      </div>
      <div className="rounded-4xl bg-card/90 p-8 shadow-lift ring-1 ring-line backdrop-blur sm:p-10">
        <p className="font-hand text-2xl text-brand-deep">{note}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        <p className="mt-1 text-sm text-mute">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}

function Feedback({ state }: { state: AuthState }) {
  return (
    <>
      {state.error && (
        <p role="alert" className="rounded-2xl bg-red-50 px-4 py-2.5 text-sm text-red-600 ring-1 ring-red-100">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="rounded-2xl bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700 ring-1 ring-emerald-100">
          {state.message}
        </p>
      )}
    </>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(requestPasswordReset, {});
  return (
    <>
      <Shell note="no worries" title="Forgot password?" subtitle="We'll email you a link to reset it">
        <form action={formAction} className="mt-8 space-y-4">
          <Field label="Email" htmlFor="email">
            <input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" className={INPUT} />
          </Field>
          <Feedback state={state} />
          <button type="submit" disabled={pending} className={SUBMIT}>
            {pending ? "Sending…" : "Send reset link"}
          </button>
        </form>
      </Shell>
      <p className="mt-6 text-center text-sm text-mute">
        <Link href="/login" className="font-semibold text-brand-deep hover:underline">
          Back to log in
        </Link>
      </p>
    </>
  );
}

export function UpdatePasswordForm() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(updatePassword, {});
  return (
    <Shell note="almost done" title="Set a new password" subtitle="Choose something you'll remember">
      <form action={formAction} className="mt-8 space-y-4">
        <Field label="New password" htmlFor="password">
          <PasswordInput id="password" name="password" autoComplete="new-password" required minLength={6} placeholder="••••••••" className={INPUT} />
        </Field>
        <Field label="Confirm password" htmlFor="confirm">
          <PasswordInput id="confirm" name="confirm" autoComplete="new-password" required minLength={6} placeholder="••••••••" className={INPUT} />
        </Field>
        <Feedback state={state} />
        <button type="submit" disabled={pending} className={SUBMIT}>
          {pending ? "Saving…" : "Update password"}
        </button>
      </form>
    </Shell>
  );
}
