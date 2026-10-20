import { Brushstroke, Logo, WatercolorBackdrop } from "@/components/watercolor";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="paper-grain relative grid flex-1 lg:grid-cols-[1fr_1.05fr]">
      <WatercolorBackdrop />

      {/* Watercolor panel, like the reference's welcome screen. */}
      <aside className="hero-wash text-shadow-soft relative hidden overflow-hidden p-10 text-white lg:flex lg:flex-col">
        <div aria-hidden className="wash animate-drift -top-20 -left-10 h-96 w-96 bg-white/20" />
        <div
          aria-hidden
          className="wash animate-drift right-0 bottom-0 h-80 w-md bg-[#c47596]/40"
          style={{ animationDelay: "-9s" }}
        />
        <div className="relative">
          <Logo tone="white" />
        </div>
        <div className="relative my-auto max-w-md">
          <p className="font-hand text-3xl text-white/90">welcome to</p>
          <h2 className="mt-1 text-5xl leading-tight font-bold tracking-tight uppercase">
            <span className="relative inline-block">
              Your gallery
              <Brushstroke className="absolute -bottom-2 left-0 h-4 w-full text-white/80" />
            </span>
            <br />
            of moments
          </h2>
          <p className="mt-8 max-w-sm leading-relaxed text-white/95">
            Every screenshot you keep is a little note to your future self. We&apos;ll
            frame it, label it and hang it where you can find it again.
          </p>
        </div>
        <p className="relative font-hand text-2xl text-white/90">— made for the camera-roll hoarder in you ✿</p>
      </aside>

      <div className="relative flex items-center justify-center px-5 py-14">{children}</div>
    </main>
  );
}
