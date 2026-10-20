import Link from "next/link";
import { Suspense } from "react";
import { AccountDeletedNotice } from "@/components/account-deleted-notice";
import { Brushstroke, Logo, WatercolorBackdrop } from "@/components/watercolor";

// Sample photos (in /public/landing). Each floats on its own slow rhythm so
// the pile never moves in lockstep.
const prints = [
  { src: "/landing/paris.webp", alt: "The Eiffel Tower at sunset", caption: "paris sunset", tilt: "-rotate-6", pos: "left-0 top-10", fit: "object-[50%_30%]", float: { duration: "7s", delay: "0s" } },
  { src: "/landing/gcash-qr.webp", alt: "A GCash scan-to-pay QR sign", caption: "gcash qr ✓", tilt: "rotate-3", pos: "left-24 top-0", fit: "object-top", float: { duration: "8.5s", delay: "-3s" } },
  { src: "/landing/sunflowers.webp", alt: "Sunflowers against a blue sky", caption: "sunflowers ✿", tilt: "-rotate-2", pos: "left-12 top-36", fit: "object-center", float: { duration: "6.5s", delay: "-1.5s" } },
];

const features = [
  {
    title: "Reads every word",
    body: "OCR pulls the text out of each screenshot so nothing gets lost.",
    note: "copy in one tap",
  },
  {
    title: "Hangs it in the right room",
    body: "AI sorts photos into albums you can rename, recolor and create.",
    note: "your categories",
  },
  {
    title: "Finds it in a blink",
    body: "Search by what's inside the picture, not by file name.",
    note: "“order total”",
  },
];

export default function Home() {
  return (
    <div className="paper-grain relative flex flex-1 flex-col overflow-hidden">
      <WatercolorBackdrop intensity="bold" />

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <Logo />
        <Link
          href="/login"
          className="rounded-full px-4 py-2 text-sm font-medium text-ink/70 transition hover:bg-card/70 hover:text-ink"
        >
          Log in
        </Link>
      </header>
      {/* useSearchParams needs a Suspense boundary; the page stays static. */}
      <Suspense fallback={null}>
        <AccountDeletedNotice />
      </Suspense>

      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-14 px-5 pt-6 pb-20 sm:px-8 lg:grid-cols-[1.1fr_1fr] lg:pt-12">
        <section>
          <p className="font-hand text-2xl text-brand-deep">hello, tidy camera roll —</p>
          <h1 className="mt-2 text-4xl leading-[1.1] font-bold tracking-tight text-ink sm:text-6xl">
            Your screenshots,
            <br />
            <span className="relative inline-block text-brand-deep">
              curated like art
              <Brushstroke className="absolute -bottom-3 left-0 h-4 w-full text-blush" />
            </span>
          </h1>
          <p className="mt-7 max-w-lg text-base leading-relaxed text-mute sm:text-lg">
            Snapzy reads, summarizes and sorts every picture you drop in. Receipts,
            WiFi passwords, boarding passes and memes each find their own wall.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="/signup"
              className="rounded-full bg-brand px-7 py-3.5 text-sm font-semibold tracking-wide text-white uppercase shadow-lift transition hover:-translate-y-0.5 hover:bg-brand-deep"
            >
              Get started
            </Link>
            <Link
              href="/login"
              className="rounded-full bg-card/80 px-7 py-3.5 text-sm font-semibold tracking-wide text-brand-deep uppercase shadow-soft ring-1 ring-line backdrop-blur transition hover:-translate-y-0.5 hover:bg-card"
            >
              I have an account
            </Link>
          </div>
        </section>

        {/* A little pile of "prints" that fans out on hover. */}
        <section aria-hidden className="group relative mx-auto h-80 w-72 sm:h-96 sm:w-80">
          {prints.map((p, i) => (
            <figure
              key={p.caption}
              style={{ animationDuration: p.float.duration, animationDelay: p.float.delay }}
              className={`animate-float absolute ${p.pos} ${p.tilt} w-48 rounded-md bg-card p-2.5 pb-9 shadow-lift transition-[rotate,translate] duration-500 ease-out sm:w-56 ${
                i === 0
                  ? "group-hover:-translate-x-6 group-hover:-rotate-12"
                  : i === 1
                    ? "group-hover:translate-x-8 group-hover:rotate-9"
                    : "group-hover:translate-y-6 group-hover:rotate-1"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.src} alt={p.alt} className={`aspect-4/5 w-full rounded-sm object-cover ${p.fit}`} />
              <figcaption className="absolute right-0 bottom-1.5 left-0 text-center font-hand text-xl text-ink/70">
                {p.caption}
              </figcaption>
            </figure>
          ))}
          <span className="absolute -right-4 -bottom-6 rotate-[-8deg] rounded-full bg-card px-4 py-2 font-hand text-xl text-brand-deep shadow-soft">
            sorted by AI ✿
          </span>
        </section>
      </main>

      <section className="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-8">
        <div className="mb-5 flex items-end justify-between">
          <h2 className="text-lg font-semibold text-ink">Why it feels different</h2>
          <span className="font-hand text-xl text-mute">a gallery, not a folder</span>
        </div>
        <ul className="grid gap-5 sm:grid-cols-3">
          {features.map((f, i) => (
            <li
              key={f.title}
              className="animate-rise rounded-3xl bg-card/85 p-6 shadow-soft ring-1 ring-line backdrop-blur"
              style={{ animationDelay: `${i * 120}ms` }}
            >
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-soft font-hand text-2xl text-brand-deep">
                {i + 1}
              </span>
              <h3 className="mt-4 font-semibold text-ink">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-mute">{f.body}</p>
              <p className="mt-4 font-hand text-xl text-brand-deep">{f.note}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
