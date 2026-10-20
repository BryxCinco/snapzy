import Link from "next/link";
import { Logo, WatercolorBackdrop } from "@/components/watercolor";

export type LegalSection = { heading: string; body: React.ReactNode };

export function LegalPage({
  note,
  title,
  updated,
  intro,
  sections,
}: {
  note: string;
  title: string;
  updated?: string;
  intro: React.ReactNode;
  sections: LegalSection[];
}) {
  return (
    <div className="paper-grain relative flex flex-1 flex-col">
      <WatercolorBackdrop />
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 py-6">
        <Logo />
        <Link
          href="/dashboard/settings"
          className="rounded-full bg-card px-4 py-2 text-sm font-medium text-ink/70 shadow-soft ring-1 ring-line transition hover:text-brand-deep"
        >
          ← Settings
        </Link>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-20">
        <article className="animate-rise rounded-4xl bg-card/90 p-7 shadow-soft ring-1 ring-line backdrop-blur sm:p-10">
          <p className="font-hand text-2xl leading-none text-brand-deep">{note}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink">{title}</h1>
          {updated && <p className="mt-2 text-sm text-mute">Last updated {updated}</p>}
          <div className="mt-6 space-y-4 leading-relaxed text-ink/80">{intro}</div>
          {sections.map((s, i) => (
            <section key={s.heading} className="mt-8">
              <h2 className="flex items-center gap-3 text-lg font-semibold text-ink">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-soft font-hand text-xl text-brand-deep">
                  {i + 1}
                </span>
                {s.heading}
              </h2>
              <div className="mt-2 space-y-3 pl-11 text-sm leading-relaxed text-ink/80">{s.body}</div>
            </section>
          ))}
        </article>
      </main>
    </div>
  );
}
