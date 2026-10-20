"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { type ThemeChoice, useLang, useT, useTheme } from "@/components/preferences";
import { PasswordInput } from "@/components/password-input";
import { Spinner } from "@/components/screenshot-card";
import { toast, Toaster } from "@/components/toast";
import { Logo } from "@/components/watercolor";
import { LANGUAGES, type MessageKey } from "@/lib/i18n";
import {
  deleteAccount,
  deleteAllPhotos,
  removeAvatar,
  resetCategories,
  updatePassword,
  uploadAvatar,
} from "./actions";

const APP_VERSION = "0.1.0";

const CARD = "rounded-4xl bg-card/90 p-6 shadow-soft ring-1 ring-line backdrop-blur sm:p-7";

export function SettingsHeader() {
  const t = useT();
  return (
    <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center gap-3 border-b border-line/70 bg-card/75 px-4 backdrop-blur-xl sm:px-6">
      <Link
        href="/dashboard"
        aria-label={t("settings.back")}
        className="grid h-10 w-10 place-items-center rounded-full bg-card text-ink/70 shadow-soft ring-1 ring-line transition hover:-translate-x-0.5 hover:text-brand-deep"
      >
        <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
        </svg>
      </Link>
      <Logo href="/dashboard" />
    </header>
  );
}

function CardTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {hint && <p className="mt-0.5 text-sm text-mute">{hint}</p>}
    </div>
  );
}

export function SettingsView({
  email,
  avatarUrl,
  joinedAt,
  photoCount,
  albumCount,
  logout,
}: {
  email: string;
  avatarUrl: string | null;
  joinedAt: string;
  photoCount: number;
  albumCount: number;
  logout: () => Promise<void>;
}) {
  const t = useT();
  const { lang } = useLang();
  const joined = new Intl.DateTimeFormat(lang === "tl" ? "fil-PH" : "en", {
    dateStyle: "long",
  }).format(new Date(joinedAt));

  return (
    <>
      <Toaster />
      <div className="mb-6">
        <p className="font-hand text-2xl leading-none text-brand-deep">{t("settings.note")}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">{t("settings.title")}</h1>
      </div>

      {/* Bento: account + appearance on top, language + about, then data. */}
      <div className="grid gap-4 md:grid-cols-6">
        <section className={`${CARD} animate-rise md:col-span-4`}>
          <CardTitle title={t("settings.account")} />
          <div className="flex items-center gap-4">
            <AvatarEditor email={email} avatarUrl={avatarUrl} />
            <dl className="grid min-w-0 flex-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
              <Info label={t("settings.email")} value={email} />
              <Info label={t("settings.joined")} value={joined} />
              <Info
                label={t("settings.library")}
                value={t("settings.libraryValue", { photos: photoCount, albums: albumCount })}
              />
            </dl>
          </div>
          <PasswordForm />
          <form action={logout} className="mt-5 border-t border-line pt-5">
            <button
              type="submit"
              className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-red-600 ring-1 ring-red-200 transition hover:bg-red-50 dark:ring-red-500/30 dark:hover:bg-red-500/10"
            >
              <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17l5-5-5-5M20 12H9M12 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6" />
              </svg>
              {t("settings.logout")}
            </button>
          </form>
        </section>

        <section className={`${CARD} animate-rise md:col-span-2`} style={{ animationDelay: "60ms" }}>
          <CardTitle title={t("settings.appearance")} hint={t("settings.appearanceHint")} />
          <ThemePicker />
        </section>

        <section className={`${CARD} animate-rise md:col-span-3`} style={{ animationDelay: "120ms" }}>
          <CardTitle title={t("settings.language")} hint={t("settings.languageHint")} />
          <LanguagePicker />
        </section>

        <section className={`${CARD} animate-rise md:col-span-3`} style={{ animationDelay: "180ms" }}>
          <CardTitle title={t("settings.about")} />
          <ul className="space-y-1">
            {(
              [
                ["/about", "settings.aboutLink"],
                ["/terms", "settings.terms"],
                ["/privacy", "settings.privacy"],
              ] as [string, MessageKey][]
            ).map(([href, key]) => (
              <li key={href}>
                <Link
                  href={href}
                  className="flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium text-ink transition hover:bg-paper"
                >
                  {t(key)}
                  <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4 text-mute">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-3 px-4 text-xs text-mute">
            {lang === "tl" && <>{t("settings.legalNote")} · </>}
            {t("settings.version", { version: APP_VERSION })}
          </p>
        </section>

        <section className={`${CARD} animate-rise md:col-span-6`} style={{ animationDelay: "240ms" }}>
          <CardTitle title={t("settings.data")} hint={t("settings.dataHint")} />
          <div className="grid gap-3 md:grid-cols-2">
            <DangerAction
              title={t("settings.clearPhotos")}
              hint={t("settings.clearPhotosHint")}
              done={t("settings.cleared")}
              run={deleteAllPhotos}
            />
            <DangerAction
              title={t("settings.resetCategories")}
              hint={t("settings.resetCategoriesHint")}
              done={t("settings.reset")}
              run={resetCategories}
            />
            <DeleteAccount email={email} />
          </div>
        </section>
      </div>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-mute">{label}</dt>
      <dd className="truncate font-medium text-ink" title={value}>
        {value}
      </dd>
    </div>
  );
}

function PasswordForm() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-5 rounded-full bg-brand-soft px-4 py-2 text-sm font-semibold text-brand-deep transition hover:bg-brand/20"
      >
        {t("settings.password")}
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await updatePassword(password);
          if (!result.ok) return setError(result.error);
          toast(t("settings.passwordSaved"));
          setPassword("");
          setOpen(false);
        });
      }}
      className="mt-5 flex flex-wrap items-center gap-2"
    >
      <PasswordInput
        wrapperClassName="sm:max-w-xs"
        autoComplete="new-password"
        autoFocus
        required
        minLength={6}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder={t("settings.passwordNew")}
        aria-label={t("settings.passwordNew")}
        className="h-10 rounded-full bg-paper px-5 text-sm text-ink ring-1 ring-line outline-none placeholder:text-mute/70 focus:ring-2 focus:ring-brand"
      />
      <button
        type="submit"
        disabled={pending}
        className="flex h-10 items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-deep disabled:opacity-60"
      >
        {pending && <Spinner />}
        {t("settings.passwordSave")}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="h-10 rounded-full px-3 text-sm font-medium text-mute hover:text-ink"
      >
        {t("settings.cancel")}
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}

const THEMES: { value: ThemeChoice; key: MessageKey; preview: string }[] = [
  { value: "light", key: "settings.light", preview: "bg-[#f6f8fb]" },
  { value: "dark", key: "settings.dark", preview: "bg-[#10141b]" },
  { value: "system", key: "settings.system", preview: "bg-linear-to-br from-[#f6f8fb] from-50% to-[#10141b] to-50%" },
];

function ThemePicker() {
  const t = useT();
  const { theme, setTheme } = useTheme();
  return (
    <div role="radiogroup" aria-label={t("settings.appearance")} className="grid grid-cols-3 gap-2">
      {THEMES.map((option) => {
        const active = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(option.value)}
            className={`group rounded-2xl p-1.5 text-center transition ${
              active ? "bg-brand-soft ring-2 ring-brand" : "ring-1 ring-line hover:ring-brand/50"
            }`}
          >
            {/* Tiny window preview of the theme. */}
            <span className={`relative block aspect-4/3 overflow-hidden rounded-xl ring-1 ring-black/5 ${option.preview}`}>
              <span className="absolute top-2 left-2 h-1.5 w-6 rounded-full bg-[#4fa3e3]" />
              <span className="absolute top-5 right-2 left-2 h-4 rounded-md bg-white/70 mix-blend-luminosity" />
              <span className="absolute right-2 bottom-2 h-2 w-2 rounded-full bg-[#f2c4d3]" />
            </span>
            <span className={`mt-1.5 block text-xs font-medium ${active ? "text-brand-deep" : "text-mute"}`}>
              {t(option.key)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function LanguagePicker() {
  const { lang, setLang } = useLang();
  const t = useT();
  return (
    <div role="radiogroup" aria-label={t("settings.language")} className="grid grid-cols-2 gap-2">
      {LANGUAGES.map((option) => {
        const active = lang === option.code;
        return (
          <button
            key={option.code}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setLang(option.code)}
            className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition ${
              active ? "bg-brand-soft ring-2 ring-brand" : "ring-1 ring-line hover:ring-brand/50"
            }`}
          >
            <span
              className={`grid h-9 w-9 place-items-center rounded-full text-xs font-bold ${
                active ? "bg-brand text-white" : "bg-paper text-mute"
              }`}
            >
              {option.code.toUpperCase()}
            </span>
            <span className={`text-sm font-semibold ${active ? "text-brand-deep" : "text-ink"}`}>
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function DangerAction({
  title,
  hint,
  done,
  run,
}: {
  title: string;
  hint: string;
  done: string;
  run: (confirmation: string) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const t = useT();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-3xl bg-red-50/60 p-5 ring-1 ring-red-100 dark:bg-red-500/5 dark:ring-red-500/20">
      <p className="font-semibold text-ink">{title}</p>
      <p className="mt-0.5 text-sm text-mute">{hint}</p>
      {confirming ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            startTransition(async () => {
              const result = await run(typed);
              if (!result.ok) return setError(result.error);
              toast(done);
              setTyped("");
              setConfirming(false);
            });
          }}
          className="mt-4 flex flex-wrap items-center gap-2"
        >
          <input
            autoFocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={t("settings.typeToConfirm")}
            aria-label={t("settings.typeToConfirm")}
            className="h-10 min-w-0 flex-1 rounded-full bg-card px-4 font-mono text-sm text-ink ring-1 ring-red-200 outline-none placeholder:font-sans placeholder:text-mute/70 focus:ring-2 focus:ring-red-400 dark:ring-red-500/30"
          />
          <button
            type="submit"
            disabled={pending || typed !== "DELETE"}
            className="flex h-10 items-center gap-1.5 rounded-full bg-red-500 px-4 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-40"
          >
            {pending && <Spinner />}
            {t("settings.confirm")}
          </button>
          <button
            type="button"
            onClick={() => {
              setConfirming(false);
              setTyped("");
            }}
            className="h-10 rounded-full px-3 text-sm font-medium text-mute hover:text-ink"
          >
            {t("settings.cancel")}
          </button>
          {error && <p className="w-full text-sm text-red-600">{error}</p>}
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-4 rounded-full bg-card px-4 py-2 text-sm font-semibold text-red-600 shadow-soft ring-1 ring-red-200 transition hover:bg-red-50 dark:ring-red-500/30 dark:hover:bg-red-500/10"
        >
          {title}
        </button>
      )}
    </div>
  );
}

// Asks for the password, then a final confirm, before deleting everything.
function DeleteAccount({ email }: { email: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-3xl bg-red-50/60 p-5 ring-1 ring-red-200 md:col-span-2 dark:bg-red-500/5 dark:ring-red-500/30">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-red-600">{t("settings.deleteAccount")}</p>
          <p className="mt-0.5 max-w-xl text-sm text-mute">{t("settings.deleteAccountHint")}</p>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-red-600"
          >
            {t("settings.deleteAccount")}
          </button>
        )}
      </div>

      {open && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!window.confirm(t("settings.deleteAccountConfirm", { email }))) return;
            setError(null);
            startTransition(async () => {
              // On success the action redirects away, so only errors return.
              const result = await deleteAccount(password);
              if (!result.ok) setError(result.error);
            });
          }}
          className="mt-4 flex flex-wrap items-center gap-2"
        >
          {/* Hidden username field helps password managers fill the right entry. */}
          <input type="email" value={email} readOnly hidden autoComplete="username" />
          <PasswordInput
            wrapperClassName="sm:max-w-sm"
            autoComplete="current-password"
            autoFocus
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("settings.passwordToDelete")}
            aria-label={t("settings.passwordToDelete")}
            className="h-10 rounded-full bg-card px-5 text-sm text-ink ring-1 ring-red-200 outline-none placeholder:text-mute/70 focus:ring-2 focus:ring-red-400 dark:ring-red-500/30"
          />
          <button
            type="submit"
            disabled={pending || !password}
            className="flex h-10 items-center gap-1.5 rounded-full bg-red-500 px-4 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-40"
          >
            {pending && <Spinner />}
            {t("settings.deleteForever")}
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setPassword("");
              setError(null);
            }}
            className="h-10 rounded-full px-3 text-sm font-medium text-mute hover:text-ink"
          >
            {t("settings.cancel")}
          </button>
          {error && <p className="w-full text-sm text-red-600">{error}</p>}
        </form>
      )}
    </div>
  );
}

// Round profile photo with a camera button; falls back to the initial.
function AvatarEditor({ email, avatarUrl }: { email: string; avatarUrl: string | null }) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function upload(file: File) {
    setError(null);
    const formData = new FormData();
    formData.append("avatar", file);
    startTransition(async () => {
      const result = await uploadAvatar(formData);
      if (result.ok) toast(t("settings.photoUpdated"));
      else setError(result.error);
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await removeAvatar();
      if (result.ok) toast(t("settings.photoRemoved"));
      else setError(result.error);
    });
  }

  return (
    <div className="flex shrink-0 flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={pending}
        aria-label={t("settings.changePhoto")}
        title={t("settings.changePhoto")}
        className="group relative h-20 w-20 overflow-hidden rounded-full bg-linear-to-br from-brand to-lilac text-2xl font-semibold text-white shadow-soft ring-4 ring-card transition hover:scale-105"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="grid h-full w-full place-items-center">{(email[0] ?? "?").toUpperCase()}</span>
        )}
        <span
          className={`absolute inset-0 grid place-items-center bg-ink/45 text-white transition ${
            pending ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
          }`}
        >
          {pending ? (
            <Spinner />
          ) : (
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6">
              <path strokeLinejoin="round" d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6L16.5 7h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-9Z" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
          )}
        </span>
      </button>
      {/* Text buttons too: the hover overlay never shows on touch screens. */}
      <div className="flex items-center gap-2 text-xs">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={pending}
          className="font-semibold text-brand-deep hover:underline"
        >
          {t("settings.changePhoto")}
        </button>
        {avatarUrl && (
          <button type="button" onClick={remove} disabled={pending} className="text-mute hover:text-red-600">
            {t("settings.removePhoto")}
          </button>
        )}
      </div>
      {error && <p className="max-w-40 text-center text-xs text-red-600">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
