"use client";

import Link from "next/link";
import { HfChevron } from "@/components/hf/HfChevron";

// Fælles ramme for login-, tilmeldings- og gendannelsessider: brandgrøn
// appbar (samme som /signup), indhold og en fast handlingszone nederst.
export function AuthScreen({
  title,
  backHref,
  backLabel,
  children,
  actions,
}: {
  title: string;
  backHref?: string;
  backLabel?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex h-full min-h-full flex-col bg-hf-cream">
      <div className="hf-appbar hf-appbar--brand" style={{ paddingTop: "max(16px, env(safe-area-inset-top, 0px))" }}>
        <div className="hf-appbar__slot">
          {backHref && (
            <Link
              href={backHref}
              aria-label={backLabel}
              className="flex h-full w-full items-center justify-center text-hf-white"
            >
              <HfChevron direction="left" />
            </Link>
          )}
        </div>
        <h1 className="hf-type-nav-title hf-appbar__title">{title}</h1>
        <span className="hf-appbar__slot" aria-hidden="true" />
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pt-6">{children}</div>

      {actions && <div className="flex flex-col gap-3 px-4 pb-8 pt-4">{actions}</div>}
    </div>
  );
}

export function AuthError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="hf-type-caption text-hf-red-dark">
      {message}
    </p>
  );
}

// Hash-fragmentets token (#t=…). Ligger i fragmentet, så det aldrig sendes
// til serveren i URL'en eller havner i logs.
export function readHashToken(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.hash.slice(1)).get("t") ?? "";
}

// Invitationskode fra /signup?ref=…, husket til bekræftelsessiden.
export const REFERRAL_STORAGE_KEY = "hellocal-invite";
