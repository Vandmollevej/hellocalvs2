"use client";

import { useState } from "react";
import Link from "next/link";
import { BottomSheet, BottomSheetCloseButton } from "@/components/hf/BottomSheet";
import { useTranslation } from "@/i18n/LocaleProvider";
import type { TesterOffer } from "@/lib/integration-testers";

// Popup-banneret på en integrations side (docs/DECISIONS.md 2026-10-02):
// "Bliv den første testperson … og optjen 300 points". Bundark (design.md
// §6.13) med det grønne points-kort (§6.11) og tilmeldingslinket nederst.
// Vises kun, mens pladsen er ledig; lukker brugeren det, vises det ikke
// igen for den integration på denne enhed.

export function testerPromoDismissKey(pageSlug: string) {
  return `hellocal.tester-promo.${pageSlug}`;
}

export function TesterPromoSheet({
  name,
  pageSlug,
  points,
  onClose,
  onSignedUp,
}: {
  name: string;
  pageSlug: string;
  points: number;
  onClose: () => void;
  onSignedUp: (offer: TesterOffer) => void;
}) {
  const { t } = useTranslation();
  const [state, setState] = useState<"offer" | "busy" | "signedUp" | "taken" | "error">("offer");

  function close() {
    try {
      window.localStorage.setItem(testerPromoDismissKey(pageSlug), "1");
    } catch {
      // Uden lagring vises tilbuddet bare igen næste gang.
    }
    onClose();
  }

  async function signUp() {
    setState("busy");
    const res = await fetch(`/api/integrations/${pageSlug}/tester`, { method: "POST" }).catch(() => null);
    if (res?.ok) {
      setState("signedUp");
      onSignedUp((await res.json()) as TesterOffer);
    } else {
      setState(res?.status === 409 ? "taken" : "error");
    }
  }

  const done = state === "signedUp" || state === "taken";

  return (
    <BottomSheet
      ariaLabel={t("integrations.tester.headline", { name, points })}
      onClose={close}
      footer={
        done ? (
          <BottomSheetCloseButton className="hf-bottom-sheet__skip">{t("integrations.tester.close")}</BottomSheetCloseButton>
        ) : (
          <>
            <button
              type="button"
              onClick={signUp}
              disabled={state === "busy"}
              className="hf-type-body self-center font-bold text-hf-black underline underline-offset-4 disabled:opacity-60"
            >
              {state === "busy" ? "…" : t("integrations.tester.signUp")}
            </button>
            <Link href="/betingelser#pointsystem" className="hf-type-caption self-center">
              * {t("integrations.tester.terms")}
            </Link>
          </>
        )
      }
    >
      <div className="flex flex-col gap-3 px-4 pb-2">
        <div className="rounded-lg p-4" style={{ background: "var(--hf-color-brand)" }}>
          <p className="hf-type-body font-bold" style={{ color: "var(--hf-color-white)" }}>
            *{t("integrations.tester.headline", { name, points })}
          </p>
        </div>
        <p className="hf-type-body-sm" role={state === "error" ? "alert" : undefined}>
          {state === "signedUp"
            ? t("integrations.tester.signedUp", { name, points })
            : state === "taken"
              ? t("integrations.tester.taken", { name })
              : state === "error"
                ? t("integrations.tester.error")
                : t("integrations.tester.body", { name, points })}
        </p>
      </div>
    </BottomSheet>
  );
}
