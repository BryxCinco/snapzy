"use client";

import Link from "next/link";
import { useActionState } from "react";
import { PasswordInput } from "@/components/password-input";
import { Logo } from "@/components/watercolor";
import { login, signup, type AuthState } from "./actions";

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

const INPUT =
  "w-full rounded-full bg-paper px-5 py-3 text-sm text-ink ring-1 ring-line placeholder:text-mute/70 outline-none transition focus:bg-card focus:ring-2 focus:ring-brand";

function Field({
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
