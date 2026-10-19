export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden bg-zinc-950 px-4 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[40rem] -translate-x-1/2 rounded-full bg-violet-600/20 blur-3xl"
      />
      <div className="relative w-full flex justify-center">{children}</div>
    </main>
  );
}
