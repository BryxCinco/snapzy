"use client";

import { type ComponentProps, useState } from "react";
import { useT } from "@/components/preferences";

// A password <input> with an eye button that shows / hides what you typed.
// Accepts every normal input prop; pass the same className you'd give a
// plain input (extra right padding for the button is added here).
export function PasswordInput({
  className = "",
  wrapperClassName = "",
  ...props
}: Omit<ComponentProps<"input">, "type"> & { wrapperClassName?: string }) {
  const t = useT();
  const [visible, setVisible] = useState(false);

  return (
    <span className={`relative block min-w-0 flex-1 ${wrapperClassName}`}>
      <input {...props} type={visible ? "text" : "password"} className={`${className} w-full pr-12!`} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t("auth.hidePassword") : t("auth.showPassword")}
        aria-pressed={visible}
        title={visible ? t("auth.hidePassword") : t("auth.showPassword")}
        className="absolute top-1/2 right-2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-mute transition hover:bg-brand-soft hover:text-brand-deep"
      >
        {visible ? (
          <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} className="h-4.5 w-4.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.6 5.1A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2" />
          </svg>
        ) : (
          <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} className="h-4.5 w-4.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </span>
  );
}
