"use client";

import Link from "next/link";
import { useActionState } from "react";
import { PasswordInput } from "@/components/password-input";
import { Logo } from "@/components/watercolor";
import { login, signInWithGoogle, signup, type AuthState } from "./actions";

type Mode = "login" | "signup";

const copy = {
  login: {
    note: "good to see you again",
    title: "Welcome back",
    subtitle: "Log in to your Snapzy library",
    submit: "Log in",
    pending: "Logging in…",
    switchText: "Don't have an account?",
    switchLabel: "Sign up",
    switchHref: "/signup",
  },
  signup: {
    note: "let's start your gallery",
    title: "Create your account",
    subtitle: "Start organizing screenshots with AI",
    submit: "Create account",
    pending: "Creating account…",
    switchText: "Already have an account?",
    switchLabel: "Log in",
    switchHref: "/login",
  },
} as const;

export function AuthForm({ mode }: { mode: Mode }) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    mode === "login" ? login : signup,
    {},
  );
  const [googleState, googleAction, googlePending] = useActionState<AuthState>(
    signInWithGoogle,
    {},
  );
  const t = copy[mode];

  return (
    <div className="w-full max-w-sm animate-rise">
      <div className="mb-8 flex justify-center lg:hidden">
        <Logo />
      </div>

      <div className="rounded-4xl bg-card/90 p-8 shadow-lift ring-1 ring-line backdrop-blur sm:p-10">
        <p className="font-hand text-2xl text-brand-deep">{t.note}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">{t.title}</h1>
        <p className="mt-1 text-sm text-mute">{t.subtitle}</p>

        <form action={formAction} className="mt-8 space-y-4">
          <Field label="Email" htmlFor="email">
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              className={INPUT}
            />
          </Field>

          <Field label="Password" htmlFor="password">
            <PasswordInput
              id="password"
              name="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={6}
              placeholder="••••••••"
              className={INPUT}
            />
          </Field>

          {mode === "login" && (
            <div className="-mt-1 text-right">
              <Link href="/forgot-password" className="pr-2 text-xs font-medium text-brand-deep hover:underline">
                Forgot password?
              </Link>
            </div>
          )}

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

          <button
            type="submit"
            disabled={pending}
            className="mt-2 w-full rounded-full bg-brand px-4 py-3.5 text-sm font-semibold tracking-wide text-white uppercase shadow-lift transition hover:-translate-y-0.5 hover:bg-brand-deep disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? t.pending : t.submit}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs tracking-wide text-mute uppercase">
          <span className="h-px flex-1 bg-line" />
          or
          <span className="h-px flex-1 bg-line" />
        </div>

        <form action={googleAction}>
          <button
            type="submit"
            disabled={googlePending}
            className="flex w-full items-center justify-center gap-3 rounded-full bg-card px-4 py-3 text-sm font-semibold text-ink ring-1 ring-line transition hover:-translate-y-0.5 hover:bg-paper disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <GoogleLogo />
            {googlePending ? "Redirecting…" : "Continue with Google"}
          </button>
          {googleState.error && (
            <p role="alert" className="mt-3 rounded-2xl bg-red-50 px-4 py-2.5 text-sm text-red-600 ring-1 ring-red-100">
              {googleState.error}
            </p>
          )}
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-mute">
        {t.switchText}{" "}
        <Link href={t.switchHref} className="font-semibold text-brand-deep hover:underline">
          {t.switchLabel}
        </Link>
      </p>
    </div>
  );
}

function GoogleLogo() {
  return (
    <svg aria-hidden viewBox="0 0 48 48" className="h-5 w-5">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export const INPUT =
  "w-full rounded-full bg-paper px-5 py-3 text-sm text-ink ring-1 ring-line placeholder:text-mute/70 outline-none transition focus:bg-card focus:ring-2 focus:ring-brand";

export function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="pl-4 text-xs font-medium tracking-wide text-mute uppercase">
        {label}
      </label>
      {children}
    </div>
  );
}
