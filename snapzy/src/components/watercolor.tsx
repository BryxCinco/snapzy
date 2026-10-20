import Link from "next/link";

// Decorative watercolor washes that slowly drift behind the content.
export function WatercolorBackdrop({ intensity = "soft" }: { intensity?: "soft" | "bold" }) {
  const o = intensity === "bold" ? "opacity-60" : "opacity-35";
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className={`wash animate-drift -top-32 -left-24 h-[28rem] w-[34rem] bg-brand/50 ${o}`} />
      <div
        className={`wash animate-drift top-1/3 -right-32 h-[26rem] w-[30rem] bg-blush ${o}`}
        style={{ animationDelay: "-7s" }}
      />
      <div
        className={`wash animate-drift -bottom-40 left-1/4 h-[24rem] w-[32rem] bg-lilac ${o}`}
        style={{ animationDelay: "-14s" }}
      />
    </div>
  );
}

// Hand-drawn underline that "draws" itself in.
export function Brushstroke({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 300 20"
      preserveAspectRatio="none"
      className={`pointer-events-none ${className}`}
    >
      <path
        d="M3 13c40-7 92-10 146-8 50 2 98 6 148 1"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray="400"
        className="animate-draw"
        style={{ ["--len" as string]: 400 }}
      />
    </svg>
  );
}

export function Logo({ href = "/", tone = "brand" }: { href?: string; tone?: "brand" | "white" }) {
  return (
    <Link
      href={href}
      className={`group flex items-center gap-2 font-semibold tracking-tight ${
        tone === "white" ? "text-white" : "text-ink"
      }`}
    >
      {/* The app icon (public/brand), same art as the favicon and home-screen icon. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/snapzy-icon.svg"
        alt=""
        width={36}
        height={36}
        className="h-9 w-9 drop-shadow-[0_4px_10px_rgb(47_80_160/0.3)] transition duration-300 group-hover:scale-105 group-hover:rotate-6"
      />
      <span className={`text-lg ${tone === "white" ? "" : "text-brand-deep"}`}>Snapzy</span>
    </Link>
  );
}
