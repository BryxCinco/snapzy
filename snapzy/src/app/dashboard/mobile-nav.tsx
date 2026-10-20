"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

// Window events let the nav drive components it doesn't own.
export const NAV_EVENTS = {
  search: "snapzy:focus-search",
  upload: "snapzy:open-upload",
  manage: "snapzy:open-manage",
} as const;

function emit(name: string) {
  window.dispatchEvent(new Event(name));
}

const ITEM =
  "relative flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium transition";

// Bottom tab bar on phones, like the reference's home / search / … bar.
export function MobileNav({ logout }: { logout: React.ReactNode }) {
  return (
    <nav
      aria-label="Quick actions"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line/80 bg-white/90 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:hidden"
    >
      <div className="mx-auto flex max-w-md items-end justify-between">
        <Suspense fallback={<HomeItem active />}>
          <HomeTab />
        </Suspense>
        <button type="button" onClick={() => emit(NAV_EVENTS.search)} className={`${ITEM} text-mute`}>
          <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
            <circle cx="11" cy="11" r="7" />
            <path strokeLinecap="round" d="m20 20-3.5-3.5" />
          </svg>
          Search
        </button>
        <button
          type="button"
          onClick={() => emit(NAV_EVENTS.upload)}
          aria-label="Upload photos"
          className="-mt-7 grid h-14 w-14 place-items-center rounded-full bg-brand text-white shadow-lift ring-4 ring-white transition active:scale-95"
        >
          <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-6 w-6">
            <path strokeLinecap="round" d="M12 5v14M5 12h14" />
          </svg>
        </button>
        <button type="button" onClick={() => emit(NAV_EVENTS.manage)} className={`${ITEM} text-mute`}>
          <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h10M4 17h6m4 0h6M18 7h2M14 4v6m-4 4v6" />
          </svg>
          Albums
        </button>
        {logout}
      </div>
    </nav>
  );
}

function HomeTab() {
  const params = useSearchParams();
  const atHome = !params.get("album") && !params.get("q");
  return <HomeItem active={atHome} />;
}

function HomeItem({ active }: { active: boolean }) {
  return (
    <button
      type="button"
      onClick={() => {
        window.history.pushState(null, "", window.location.pathname);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }}
      className={`${ITEM} ${active ? "text-brand-deep" : "text-mute"}`}
    >
      <svg aria-hidden viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
        <path strokeLinejoin="round" d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1v-8.5Z" />
      </svg>
      Home
      {active && <span aria-hidden className="absolute -bottom-1 h-1 w-1 rounded-full bg-brand" />}
    </button>
  );
}
