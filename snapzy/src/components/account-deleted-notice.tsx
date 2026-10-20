"use client";

import { useSearchParams } from "next/navigation";

// Shown on the landing page after Settings → Delete account redirects here.
export function AccountDeletedNotice() {
  const params = useSearchParams();
  if (params.get("account") !== "deleted") return null;
  return (
    <div
      role="status"
      className="animate-rise mx-auto mt-2 w-fit max-w-[calc(100%-2.5rem)] rounded-full bg-card px-5 py-2.5 text-sm text-ink shadow-lift ring-1 ring-line"
    >
      Your account and all its photos were deleted.{" "}
      <span className="font-hand text-lg text-brand-deep">take care ✿</span>
    </div>
  );
}
