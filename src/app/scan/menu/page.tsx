"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconBuildingBank, IconHistory, IconLogout, IconMail, IconMessage, IconReceipt, IconUser } from "@tabler/icons-react";
import { ScanScreen } from "@/components/scan/ScanScreen";
import { HfChevron } from "@/components/hf/HfChevron";

// Brugerikonets menu (docs/OPRETTELSES-APP.md). "Beskeder" og "Kontakt" er
// samme tovejs-tråd med admin (brugerbeslutning 2026-09-24).
const ITEMS = [
  { href: "/scan/profil", label: "Profil", Icon: IconUser },
  { href: "/scan/bank", label: "Bankoplysninger", Icon: IconBuildingBank },
  { href: "/scan/historik", label: "Historik", Icon: IconHistory },
  { href: "/scan/ikke-afregnet", label: "Ikke afregnet", Icon: IconReceipt },
  { href: "/scan/beskeder", label: "Beskeder", Icon: IconMessage },
  { href: "/scan/beskeder?kontakt=1", label: "Kontakt", Icon: IconMail },
];

export default function ScanMenuPage() {
  const router = useRouter();

  async function logout() {
    await fetch("/api/scan/logout", { method: "POST" });
    router.replace("/scan/login");
  }

  return (
    <ScanScreen title="Menu" showBack>
      <div className="p-4">
        <ul className="overflow-hidden rounded-[8px]" style={{ background: "var(--hf-color-card)" }}>
          {ITEMS.map(({ href, label, Icon }) => (
            <li key={href} className="border-b last:border-b-0" style={{ borderColor: "var(--hf-color-line)" }}>
              <Link href={href} className="flex h-12 items-center gap-4 px-4">
                <Icon size={20} stroke={1.8} />
                <span className="hf-type-body flex-1">{label}</span>
                <HfChevron direction="right" />
              </Link>
            </li>
          ))}
          <li>
            <button type="button" onClick={() => void logout()} className="flex h-12 w-full items-center gap-4 px-4 text-left">
              <IconLogout size={20} stroke={1.8} />
              <span className="hf-type-body flex-1">Log ud</span>
            </button>
          </li>
        </ul>
      </div>
    </ScanScreen>
  );
}
