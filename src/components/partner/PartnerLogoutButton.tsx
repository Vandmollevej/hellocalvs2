"use client";

import { useRouter } from "next/navigation";

export function PartnerLogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="hf-type-small rounded-md border border-hf-tan-dark px-3 py-1.5 text-text-secondary hover:bg-hf-tan"
      onClick={async () => {
        await fetch("/api/partner/logout", { method: "POST" });
        router.push("/partner/login");
        router.refresh();
      }}
    >
      Log ud
    </button>
  );
}
