"use client";

import { useState } from "react";
import { toast } from "@/components/toast";
import { copyToClipboard } from "@/lib/clipboard";
import type {
  FlightInfo,
  PaymentInfo,
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
          {payment.currency === "PHP" || !payment.currency ? "₱" : `${payment.currency} `}
          {payment.amount}
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

export function SmartCards({ metadata }: { metadata: ScreenshotMetadata }) {
  return (
    <div className="space-y-3">
      {metadata.wifi && <WifiCard wifi={metadata.wifi} />}
      {metadata.flight && <FlightCard flight={metadata.flight} />}
      {metadata.payment && <PaymentCard payment={metadata.payment} />}
    </div>
  );
}
