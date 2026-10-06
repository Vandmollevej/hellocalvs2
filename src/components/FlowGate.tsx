"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BottomSheet, BottomSheetDots, useBottomSheetClose } from "@/components/hf/BottomSheet";
import { ActionButton } from "@/components/hf/ActionButton";
import { HfChevron } from "@/components/hf/HfChevron";
import { useTranslation } from "@/i18n/LocaleProvider";
import { useShowStartupTips } from "@/lib/help-prefs";
import { flowHtmlToText, sanitizeFlowHtml } from "@/lib/flow-html";

// Guide-flows fra admin → Flows (docs/DECISIONS.md 2026-10-06). Ved hvert
// sideskift spørger vi serveren, om et aktivt flow passer til brugeren her
// (betingelserne i src/lib/flow-conditions.ts). "Popup" vises i bundarket,
// "banner" som et kort hint over bundmenuen. Slås fra sammen med start-up
// tips under Indstillinger → Visning → Tips.
//
// En sides ekstra knap (fx "Integrér dit ur") sender brugeren videre og
// husker flowet i sessionStorage: når brugeren går tilbage (tilbage-pilen),
// åbner flowet igen på samme side i stedet for at være lukket.

type FlowPage = {
  id: string;
  title: string;
  bodyHtml: string;
  buttonLabel: string;
  actionLabel: string | null;
  actionHref: string | null;
};
type ActiveFlow = { id: string; name: string; kind: "popup" | "banner"; pages: FlowPage[] };
type Resume = { flow: ActiveFlow; page: number; awayPrefix: string };

const RESUME_KEY = "hellocal.flow.resume";

const SKIP_PREFIXES = [
  "/betingelser",
  "/privatlivspolitik",
  "/welcome",
  "/velkommen",
  "/login",
  "/logind",
  "/signup",
  "/tilmeld",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/approve-login",
  "/account/phone",
  "/hello-doc",
  "/forward",
  "/admin",
  "/partner",
];

function matches(path: string, prefix: string) {
  return path === prefix || path.startsWith(`${prefix}/`);
}

function readResume(): Resume | null {
  try {
    const raw = window.sessionStorage.getItem(RESUME_KEY);
    return raw ? (JSON.parse(raw) as Resume) : null;
  } catch {
    return null;
  }
}

function writeResume(value: Resume | null) {
  try {
    if (value) window.sessionStorage.setItem(RESUME_KEY, JSON.stringify(value));
    else window.sessionStorage.removeItem(RESUME_KEY);
  } catch {
    // sessionStorage utilgængelig — flowet genoptages så bare ikke.
  }
}

function sendEvent(flowId: string, event: "shown" | "completed" | "dismissed") {
  void fetch(`/api/flows/${encodeURIComponent(flowId)}/event`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event }),
  }).catch(() => undefined);
}

// Højst ét nyt flow pr. app-indlæsning (som start-up tips).
let shownThisVisit = false;

export function FlowGate() {
  const pathname = usePathname() ?? "/";
  const enabled = useShowStartupTips();
  const [active, setActive] = useState<{ flow: ActiveFlow; page: number } | null>(null);

  useEffect(() => {
    if (!enabled || active) return;
    if (SKIP_PREFIXES.some((prefix) => matches(pathname, prefix))) return;

    // Tilbage fra en ekstra knap (fx integrationen)? Åbn flowet igen.
    const resume = readResume();
    if (resume) {
      if (matches(pathname, resume.awayPrefix)) return;
      const timer = window.setTimeout(() => {
        writeResume(null);
        setActive({ flow: resume.flow, page: resume.page });
      }, 0);
      return () => window.clearTimeout(timer);
    }

    let cancelled = false;
    fetch(`/api/flows/active?path=${encodeURIComponent(pathname)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { flow?: ActiveFlow | null } | null) => {
        const flow = data?.flow;
        if (cancelled || !flow || shownThisVisit || !flow.pages.length) return;
        shownThisVisit = true;
        sendEvent(flow.id, "shown");
        setActive({ flow, page: 0 });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pathname, enabled, active]);

  if (!active || !enabled) return null;

  const close = () => setActive(null);
  const dismiss = () => {
    sendEvent(active.flow.id, "dismissed");
    setActive(null);
  };

  if (active.flow.kind === "banner") {
    return (
      <FlowBanner
        flow={active.flow}
        onClose={dismiss}
        onAction={() => {
          sendEvent(active.flow.id, "completed");
          setActive(null);
        }}
      />
    );
  }

  return (
    <FlowSheet
      flow={active.flow}
      page={active.page}
      onPage={(page) => setActive({ flow: active.flow, page })}
      onClose={close}
      onDismiss={() => sendEvent(active.flow.id, "dismissed")}
      onComplete={() => sendEvent(active.flow.id, "completed")}
      onAway={(href) => {
        const awayPrefix = href.split(/[?#]/)[0];
        writeResume({ flow: active.flow, page: active.page, awayPrefix });
        setActive(null);
      }}
    />
  );
}

function FlowSheet({
  flow,
  page,
  onPage,
  onClose,
  onDismiss,
  onComplete,
  onAway,
}: {
  flow: ActiveFlow;
  page: number;
  onPage: (page: number) => void;
  onClose: () => void;
  onDismiss: () => void;
  onComplete: () => void;
  onAway: (href: string) => void;
}) {
  return (
    <BottomSheet onClose={onClose} ariaLabel={flow.name} size="half">
      <FlowSheetBody flow={flow} page={page} onPage={onPage} onDismiss={onDismiss} onComplete={onComplete} onAway={onAway} />
    </BottomSheet>
  );
}

function FlowSheetBody({
  flow,
  page,
  onPage,
  onDismiss,
  onComplete,
  onAway,
}: {
  flow: ActiveFlow;
  page: number;
  onPage: (page: number) => void;
  onDismiss: () => void;
  onComplete: () => void;
  onAway: (href: string) => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const closeSheet = useBottomSheetClose();
  const current = flow.pages[Math.min(page, flow.pages.length - 1)];
  const html = useMemo(() => sanitizeFlowHtml(current.bodyHtml), [current.bodyHtml]);
  const last = page >= flow.pages.length - 1;

  return (
    <div className="flex flex-col gap-4 pb-2">
      <div className="flex min-h-11 items-center gap-2">
        {page > 0 ? (
          <button
            type="button"
            onClick={() => onPage(page - 1)}
            aria-label={t("common.back")}
            className="hf-btn-icon -ml-2 text-hf-black"
          >
            <HfChevron direction="left" />
          </button>
        ) : (
          <span className="size-11" aria-hidden="true" />
        )}
        <div className="flex flex-1 justify-center">
          {flow.pages.length > 1 && (
            <BottomSheetDots count={flow.pages.length} active={page} label={`${page + 1} / ${flow.pages.length}`} />
          )}
        </div>
        <span className="size-11" aria-hidden="true" />
      </div>

      {current.title && <h2 className="hf-type-page-title hf-heading text-hf-black">{current.title}</h2>}
      {html && (
        <div
          className="flex flex-col gap-3 hf-type-body text-text-secondary [&_a]:text-hf-green [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}

      <div className="flex flex-col gap-3 pt-2">
        {current.actionLabel && current.actionHref && (
          <ActionButton
            variant="secondary"
            className="h-12 px-4"
            onClick={() => {
              const href = current.actionHref as string;
              onAway(href);
              router.push(href);
            }}
          >
            {current.actionLabel}
          </ActionButton>
        )}
        <ActionButton
          className="h-12 px-4"
          onClick={() => {
            if (last) {
              onComplete();
              closeSheet();
            } else {
              onPage(page + 1);
            }
          }}
        >
          {current.buttonLabel || t("onboarding.next")}
        </ActionButton>
        <button
          type="button"
          onClick={() => {
            onDismiss();
            closeSheet();
          }}
          className="hf-btn-text mx-auto text-text-secondary"
        >
          {t("onboarding.doNotShowAgain")}
        </button>
      </div>
    </div>
  );
}

function FlowBanner({ flow, onClose, onAction }: { flow: ActiveFlow; onClose: () => void; onAction: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const page = flow.pages[0];
  const text = useMemo(() => flowHtmlToText(page.bodyHtml), [page.bodyHtml]);

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-24 z-[45] mx-auto flex max-w-md items-start gap-3 rounded-lg border border-hf-tan-dark bg-hf-white p-4 shadow-lg"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {page.title && <p className="hf-type-body hf-type-strong text-hf-black">{page.title}</p>}
        {text && <p className="hf-type-small text-text-secondary">{text}</p>}
        {page.actionLabel && page.actionHref && (
          <button
            type="button"
            onClick={() => {
              onAction();
              router.push(page.actionHref as string);
            }}
            className="hf-btn-text w-fit px-0 text-hf-green"
          >
            {page.actionLabel}
          </button>
        )}
      </div>
      <button type="button" onClick={onClose} aria-label={t("common.close")} className="hf-btn-icon -mr-2 -mt-2 text-hf-black">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
