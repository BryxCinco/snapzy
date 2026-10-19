import Link from "next/link";

const features = [
  {
    title: "Reads your screenshots",
    body: "OCR pulls the text out of every image so nothing gets lost.",
  },
  {
    title: "Sorts them for you",
    body: "AI writes a summary and drops each shot into the right category.",
  },
  {
    title: "Find anything fast",
    body: "Search by what's inside the picture, not by file name.",
  },
];

export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[28rem] w-[48rem] -translate-x-1/2 rounded-full bg-violet-600/20 blur-3xl"
      />

      <header className="relative mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-linear-to-br from-violet-500 to-cyan-400 text-sm font-bold text-zinc-950">
            S
          </span>
          Snapzy
        </div>
        <Link
          href="/login"
          className="text-sm font-medium text-zinc-300 hover:text-white"
        >
          Log in
        </Link>
      </header>

      <main className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-6 py-20 text-center">
        <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-300">
          AI-Powered Screenshot Sorter
        </span>
        <h1 className="mt-6 max-w-2xl text-4xl font-semibold tracking-tight sm:text-6xl">
          Your screenshots,{" "}
          <span className="bg-linear-to-r from-violet-400 to-cyan-300 bg-clip-text text-transparent">
            finally organized
          </span>
        </h1>
        <p className="mt-5 max-w-xl text-lg text-zinc-400">
          Snapzy reads, summarizes, and categorizes every screenshot you upload,
          so you can find that receipt, meme, or code snippet in seconds.
        </p>
        <Link
          href="/login"
          className="mt-10 rounded-lg bg-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition hover:bg-violet-500"
        >
          Get Started
        </Link>

        <ul className="mt-20 grid w-full gap-4 text-left sm:grid-cols-3">
          {features.map((f) => (
            <li
              key={f.title}
              className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5"
            >
              <h2 className="font-medium text-zinc-100">{f.title}</h2>
              <p className="mt-1 text-sm text-zinc-400">{f.body}</p>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
