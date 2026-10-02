"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { BottomSheet, BottomSheetCloseButton } from "@/components/hf/BottomSheet";
import { isPublicPath } from "@/components/AuthGate";
import { useTranslation } from "@/i18n/LocaleProvider";
import type { SentNotice } from "@/lib/sent-notices";

// "Til info sendte vi dig den … en e-mail om …. Dette var ikke spam."
// (docs/DECISIONS.md 2026-10-02). Vises som det første efter login, så længe
// der er sendte mails/sms'er, brugeren ikke har kvitteret for. "Læst"
// kvitterer; et træk ned lukker kun til næste besøg.
let checkedThisVisit = false;

export function SentMessageNotice() {
  const { t, locale } = useTranslation();
  const pathname = usePathname() ?? "/";
  const [notices, setNotices] = useState<SentNotice[]>([]);

  useEffect(() => {
    if (checkedThisVisit || isPublicPath(pathname)) return;
    checkedThisVisit = true;
    fetch("/api/messages/sent-notices")
      .then((res) => {
        // Ikke logget ind endnu: prøv igen efter login.
        if (res.status === 401) checkedThisVisit = false;
        return res.ok ? (res.json() as Promise<{ notices: SentNotice[] }>) : null;
      })
      .then((data) => setNotices(data?.notices ?? []))
      .catch(() => {
        checkedThisVisit = false;
      });
  }, [pathname]);

  if (notices.length === 0) return null;

  function markRead() {
    void fetch("/api/messages/sent-notices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: notices.map((notice) => notice.id) }),
    }).catch(() => undefined);
  }

  const dateFormat = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "da-DK", { day: "numeric", month: "long", year: "numeric" });

  return (
    <BottomSheet
      title={t("sentNotice.title")}
      onClose={() => setNotices([])}
      footer={
        <BottomSheetCloseButton onClick={markRead} className="hf-control hf-btn-primary w-full">
          {t("sentNotice.read")}
        </BottomSheetCloseButton>
      }
    >
      <div className="flex flex-col gap-4 px-4">
        {notices.map((notice) => (
          <p key={notice.id} className="hf-type-body-lg">
            {t("sentNotice.body", {
              date: dateFormat.format(new Date(notice.sentAt)),
              type: t(notice.kind === "SMS" ? "sentNotice.typeSms" : "sentNotice.typeEmail"),
              subject: notice.subject,
            })}
          </p>
        ))}
      </div>
    </BottomSheet>
  );
}
