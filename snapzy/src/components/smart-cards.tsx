"use client";

import { useState } from "react";
import { toast } from "@/components/toast";
import { copyToClipboard } from "@/lib/clipboard";
import type {
  CodeInfo,
  Credential,
  FlightInfo,
  PaymentInfo,
  ReceiptInfo,
  ScreenshotMetadata,
  WifiInfo,
} from "@/lib/metadata";

async function copy(value: string, label: string) {
  try {
    await copyToClipboard(value);
    toast(`${label} copied!`);
  } catch {
    toast("Couldn't copy. Clipboard access was blocked.");
  }
}

function CopyButton({ value, label }: { value: string; label: string }) {
  return (
    <button
      type="button"
      onClick={() => copy(value, label)}
      className="flex shrink-0 items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/20"
    >
      <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
        <rect x="9" y="9" width="11" height="11" rx="2" />
        <path strokeLinecap="round" d="M5 15V6a2 2 0 0 1 2-2h8" />
      </svg>
      Copy {label.toLowerCase()}
    </button>
  );
}

function SmartShell({
  title,
  icon,
  tone,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  tone: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className={`relative overflow-hidden rounded-2xl p-4 text-white ring-1 ring-white/10 ${tone}`}
    >
      <div aria-hidden className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
      <div className="relative flex items-center gap-2 text-xs font-semibold tracking-wide text-white/80 uppercase">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-white/15">{icon}</span>
        {title}
      </div>
      <div className="relative mt-3">{children}</div>
    </section>
  );
}

function WifiCard({ wifi }: { wifi: WifiInfo }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <SmartShell
      title="WiFi network"
      tone="bg-linear-to-br from-sky-600 to-indigo-700"
      icon={
        <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
          <path strokeLinecap="round" d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0" />
          <circle cx="12" cy="19.5" r="1" fill="currentColor" />
        </svg>
      }
    >
      <p className="text-xs text-white/70">Network</p>
      <p className="truncate text-lg font-semibold">{wifi.ssid}</p>
      {wifi.password ? (
        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-white/70">
              Password{wifi.security && <span className="text-white/50"> · {wifi.security}</span>}
            </p>
            <button
              type="button"
              onClick={() => setRevealed((r) => !r)}
              title={revealed ? "Hide password" : "Show password"}
              className="max-w-full truncate font-mono text-base tracking-wide"
            >
              {revealed ? wifi.password : "•".repeat(Math.min(wifi.password.length, 14))}
            </button>
          </div>
          <CopyButton value={wifi.password} label="Password" />
        </div>
      ) : (
        <p className="mt-2 text-sm text-white/70">No password shown (open network?).</p>
      )}
    </SmartShell>
  );
}

function FlightCard({ flight }: { flight: FlightInfo }) {
  const details: [string, string | null][] = [
    ["Date", flight.date],
    ["Departs", flight.departure_time],
    ["Gate", flight.gate],
    ["Seat", flight.seat],
  ];
  return (
    <SmartShell
      title="Flight"
      tone="bg-linear-to-br from-violet-600 to-fuchsia-700"
      icon={
        <svg aria-hidden viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
          <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5Z" />
        </svg>
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-semibold">
            {flight.flight_number ?? "Flight"}
          </p>
          {(flight.airline || flight.passenger) && (
            <p className="truncate text-xs text-white/70">
              {[flight.airline, flight.passenger].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        {flight.booking_reference && (
          <CopyButton value={flight.booking_reference} label="Booking ref" />
        )}
      </div>
      {(flight.from || flight.to) && (
        <div className="mt-3 flex items-center gap-3 font-mono text-2xl font-bold tracking-wider">
          <span>{flight.from ?? "—"}</span>
          <span aria-hidden className="h-px flex-1 border-t border-dashed border-white/40" />
          <span>{flight.to ?? "—"}</span>
        </div>
      )}
      <dl className="mt-3 grid grid-cols-4 gap-2 border-t border-white/15 pt-3">
        {details.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-[10px] text-white/60 uppercase">{label}</dt>
            <dd className="truncate text-sm font-semibold">{value ?? "—"}</dd>
          </div>
        ))}
      </dl>
      {flight.booking_reference && (
        <p className="mt-2 text-xs text-white/70">
          Booking ref <span className="font-mono text-white">{flight.booking_reference}</span>
        </p>
      )}
    </SmartShell>
  );
}

function PaymentCard({ payment }: { payment: PaymentInfo }) {
  return (
    <SmartShell
      title={payment.provider ? `${payment.provider} payment` : "Payment"}
      tone="bg-linear-to-br from-emerald-600 to-teal-700"
      icon={
        <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <path strokeLinecap="round" d="M3 10h18M7 15h3" />
        </svg>
      }
    >
      {payment.amount && (
        <p className="text-3xl font-bold tabular-nums tracking-tight">
          {money(payment.amount, payment.currency)}
        </p>
      )}
      {(payment.recipient || payment.date) && (
        <p className="mt-1 truncate text-xs text-white/70">
          {[payment.recipient && `To ${payment.recipient}`, payment.date].filter(Boolean).join(" · ")}
        </p>
      )}
      {payment.reference_number && (
        <div className="mt-3 flex items-end justify-between gap-3 border-t border-white/15 pt-3">
          <div className="min-w-0">
            <p className="text-xs text-white/70">Reference no.</p>
            <p className="truncate font-mono text-base">{payment.reference_number}</p>
          </div>
          <CopyButton value={payment.reference_number} label="Reference" />
        </div>
      )}
    </SmartShell>
  );
}

function money(amount: string, currency: string | null) {
  return `${currency === "PHP" || !currency ? "₱" : `${currency} `}${amount}`;
}

function ReceiptCard({ receipt }: { receipt: ReceiptInfo }) {
  return (
    <SmartShell
      title={receipt.merchant ?? "Receipt"}
      tone="bg-linear-to-br from-teal-600 to-cyan-800"
      icon={
        <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
          <path strokeLinejoin="round" d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" />
          <path strokeLinecap="round" d="M9 8h6M9 12h6" />
        </svg>
      }
    >
      {receipt.items.length > 0 && (
        <ul className="max-h-44 space-y-1 overflow-y-auto pr-1 text-sm">
          {receipt.items.map((item, i) => (
            <li key={i} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-white/90">
                {item.quantity && <span className="text-white/60">{item.quantity}× </span>}
                {item.name}
              </span>
              {item.price && (
                <span className="shrink-0 font-mono text-xs text-white/80 tabular-nums">{item.price}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      <div
        className={`flex items-end justify-between gap-3 ${
          receipt.items.length > 0 ? "mt-3 border-t border-dashed border-white/25 pt-3" : ""
        }`}
      >
        <div className="min-w-0">
          <p className="text-xs text-white/70">Total</p>
          <p className="text-2xl font-bold tabular-nums tracking-tight">
            {receipt.total ? money(receipt.total, receipt.currency) : "—"}
          </p>
        </div>
        {receipt.receipt_number && <CopyButton value={receipt.receipt_number} label="Receipt no." />}
      </div>
      {(receipt.date || receipt.receipt_number) && (
        <p className="mt-1 truncate text-xs text-white/70">
          {[receipt.date, receipt.receipt_number && `No. ${receipt.receipt_number}`]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
    </SmartShell>
  );
}

function SecretValue({ value }: { value: string }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setRevealed((r) => !r)}
      title={revealed ? "Hide" : "Show"}
      className="max-w-full truncate font-mono text-sm tracking-wide"
    >
      {revealed ? value : "•".repeat(Math.min(value.length, 14))}
    </button>
  );
}

function CredentialsCard({ credentials }: { credentials: Credential[] }) {
  return (
    <SmartShell
      title={credentials.length === 1 ? "Login" : `${credentials.length} logins`}
      tone="bg-linear-to-br from-rose-600 to-red-800"
      icon={
        <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path strokeLinecap="round" d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
      }
    >
      <ul className="space-y-3">
        {credentials.map((c, i) => (
          <li key={i} className={i > 0 ? "border-t border-white/15 pt-3" : ""}>
            {c.service && <p className="truncate text-sm font-semibold">{c.service}</p>}
            {c.username && (
              <div className="mt-1 flex items-center justify-between gap-3">
                <p className="min-w-0 truncate text-sm">
                  <span className="text-white/60">User </span>
                  {c.username}
                </p>
                <CopyButton value={c.username} label="Username" />
              </div>
            )}
            {c.password && (
              <div className="mt-1.5 flex items-center justify-between gap-3">
                <p className="flex min-w-0 items-center gap-1 text-sm">
                  <span className="text-white/60">Pass </span>
                  <SecretValue value={c.password} />
                </p>
                <CopyButton value={c.password} label="Password" />
              </div>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-white/60">
        Stored with your photo. Consider moving real passwords to a password manager.
      </p>
    </SmartShell>
  );
}

// Only http(s) links become clickable; bare domains get https:// added.
function safeUrl(raw: string): string | null {
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function CodesCard({ codes }: { codes: CodeInfo[] }) {
  return (
    <SmartShell
      title={codes.every((c) => c.kind === "barcode") ? "Barcode" : "QR code"}
      tone="bg-linear-to-br from-zinc-700 to-zinc-900"
      icon={
        <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <path strokeLinecap="round" d="M14 14h3v3h-3zM20 14v.01M20 20v.01M17 20h.01" />
        </svg>
      }
    >
      <ul className="space-y-3">
        {codes.map((code, i) => {
          const href = /^https?:\/\//i.test(code.value) ? safeUrl(code.value) : null;
          return (
            <li key={i} className={i > 0 ? "border-t border-white/15 pt-3" : ""}>
              <p className="text-[11px] text-white/60 uppercase">
                {code.kind === "qr" ? "QR" : "Barcode"} ·{" "}
                {code.source === "qr-decoder" ? "decoded" : "read from image"}
              </p>
              <p className="mt-0.5 font-mono text-sm break-all">{code.value}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {href && (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-900 transition hover:bg-white/90"
                  >
                    Open link
                    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5h5v5M19 5l-8 8M10 5H5v14h14v-5" />
                    </svg>
                  </a>
                )}
                <CopyButton value={code.value} label="Code" />
              </div>
            </li>
          );
        })}
      </ul>
      {codes.some((c) => c.kind === "qr" && c.source === "qr-decoder") && (
        <p className="mt-3 text-[11px] text-white/60">
          Check where a link goes before opening it.
        </p>
      )}
    </SmartShell>
  );
}

type ContactRow = {
  key: string;
  label: string;
  value: string;
  href: string | null;
  external?: boolean;
};

function ContactsCard({ metadata }: { metadata: ScreenshotMetadata }) {
  const rows: ContactRow[] = [
    ...(metadata.names ?? []).map((v) => ({ key: `n-${v}`, label: "Name", value: v, href: null })),
    ...(metadata.emails ?? []).map((v) => ({
      key: `e-${v}`,
      label: "Email",
      value: v,
      href: `mailto:${v}`,
    })),
    ...(metadata.phones ?? []).map((v) => ({
      key: `p-${v}`,
      label: "Phone",
      value: v,
      href: `tel:${v.replace(/[^\d+]/g, "")}`,
    })),
    ...(metadata.socials ?? []).map((s) => ({
      key: `s-${s.platform}-${s.handle ?? s.url}`,
      label: s.platform,
      value: s.handle ?? s.url ?? "",
      href: s.url ? safeUrl(s.url) : null,
      external: true,
    })),
    ...(metadata.links ?? [])
      // A QR link already has its own card.
      .filter((v) => !metadata.codes?.some((c) => c.value === v))
      .map((v) => ({ key: `l-${v}`, label: "Link", value: v, href: safeUrl(v), external: true })),
    ...(metadata.addresses ?? []).map((v) => ({
      key: `a-${v}`,
      label: "Address",
      value: v,
      href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v)}`,
      external: true,
    })),
  ];
  if (rows.length === 0) return null;

  return (
    <SmartShell
      title="Contact details"
      tone="bg-linear-to-br from-blue-600 to-indigo-800"
      icon={
        <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
          <circle cx="12" cy="8" r="4" />
          <path strokeLinecap="round" d="M4 21a8 8 0 0 1 16 0" />
        </svg>
      }
    >
      <ul className="divide-y divide-white/10">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-white/60">{row.label}</p>
              {row.href ? (
                <a
                  href={row.href}
                  {...(row.external ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {})}
                  className="block truncate text-sm font-medium underline decoration-white/30 underline-offset-2 hover:decoration-white"
                >
                  {row.value}
                </a>
              ) : (
                <p className="truncate text-sm font-medium">{row.value}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => copy(row.value, row.label)}
              aria-label={`Copy ${row.label.toLowerCase()}`}
              title="Copy"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/10 ring-1 ring-white/15 transition hover:bg-white/20"
            >
              <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
                <rect x="9" y="9" width="11" height="11" rx="2" />
                <path strokeLinecap="round" d="M5 15V6a2 2 0 0 1 2-2h8" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </SmartShell>
  );
}

export function SmartCards({ metadata }: { metadata: ScreenshotMetadata }) {
  return (
    <div className="space-y-3">
      {metadata.wifi && <WifiCard wifi={metadata.wifi} />}
      {metadata.payment && <PaymentCard payment={metadata.payment} />}
      {metadata.receipt && <ReceiptCard receipt={metadata.receipt} />}
      {metadata.flight && <FlightCard flight={metadata.flight} />}
      {metadata.credentials && <CredentialsCard credentials={metadata.credentials} />}
      {metadata.codes && <CodesCard codes={metadata.codes} />}
      <ContactsCard metadata={metadata} />
    </div>
  );
}
