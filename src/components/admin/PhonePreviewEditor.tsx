"use client";

// Fælles admin-vindue til indhold der vises på telefonen (docs/DECISIONS.md
// 2026-09-27, "Telefon-editor i admin"): venstre halvdel viser en sort
// iPhone 17 med indholdet, højre halvdel er redigeringen. Bruges af mails,
// notifikationer, svarskabeloner og Flows.

// iPhone 17 (og 17 Pro): 1206 × 2622 px skærm @3x = 402 × 874 CSS-px.
export const IPHONE17_WIDTH = 402;
export const IPHONE17_HEIGHT = 874;
const BEZEL = 12;
const SCREEN_RADIUS = 55;

export function PhonePreviewEditor({
  preview,
  previewControls,
  darkScreen = false,
  children,
}: {
  preview: React.ReactNode;
  previewControls?: React.ReactNode;
  darkScreen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="flex flex-col items-center gap-3 lg:sticky lg:top-20 lg:items-end lg:self-start">
        {previewControls}
        <div className="max-w-full overflow-x-auto">
          <IPhone17Frame dark={darkScreen}>{preview}</IPhone17Frame>
        </div>
        <p className="hf-type-small text-text-muted" style={{ width: IPHONE17_WIDTH + BEZEL * 2 }}>
          iPhone 17 · {IPHONE17_WIDTH} × {IPHONE17_HEIGHT} px
        </p>
      </div>
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </div>
  );
}

export function IPhone17Frame({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <div
      className="box-content shrink-0 bg-black shadow-xl"
      style={{ padding: BEZEL, borderRadius: SCREEN_RADIUS + BEZEL }}
    >
      <div
        className={`relative flex flex-col overflow-hidden ${dark ? "bg-black text-white" : "bg-white text-black"}`}
        style={{ width: IPHONE17_WIDTH, height: IPHONE17_HEIGHT, borderRadius: SCREEN_RADIUS }}
      >
        <StatusBar light={dark} />
        {/* Dynamic Island */}
        <div className="pointer-events-none absolute left-1/2 top-[11px] z-20 h-[37px] w-[126px] -translate-x-1/2 rounded-full bg-black" />
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        <div className="pointer-events-none absolute bottom-2 left-1/2 z-20 h-[5px] w-[139px] -translate-x-1/2 rounded-full bg-current opacity-80" />
      </div>
    </div>
  );
}

function StatusBar({ light }: { light: boolean }) {
  return (
    <div
      className={`relative z-10 flex h-[54px] shrink-0 items-center justify-between px-8 pt-1 text-[16px] font-semibold ${
        light ? "text-white" : "text-black"
      }`}
    >
      <span className="w-[54px] text-center">9:41</span>
      <span className="flex items-center gap-1.5" aria-hidden="true">
        <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor">
          <rect x="0" y="8" width="3" height="4" rx="1" />
          <rect x="5" y="5.5" width="3" height="6.5" rx="1" />
          <rect x="10" y="3" width="3" height="9" rx="1" />
          <rect x="15" y="0" width="3" height="12" rx="1" />
        </svg>
        <svg width="26" height="12" viewBox="0 0 26 12" fill="none" stroke="currentColor">
          <rect x="0.5" y="0.5" width="22" height="11" rx="3.5" opacity="0.4" />
          <rect x="2" y="2" width="19" height="8" rx="2" fill="currentColor" stroke="none" />
          <path d="M24.5 4v4" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
        </svg>
      </span>
    </div>
  );
}

// Eksempelværdier til {{variabler}}, så forhåndsvisningen ligner en rigtig
// besked. Ukendte variabler bliver stående, så man kan se dem.
const SAMPLE_VARS: Record<string, string> = {
  displayName: "Peter",
  navn: "Peter",
  friendName: "Anna",
  productName: "Skyr naturel",
  points: "300",
  reason: "Billedet var uskarpt",
};

export function fillSampleVars(text: string) {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key: string) => SAMPLE_VARS[key] ?? match);
}

export function htmlToPlainText(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

// HTML vises i en sandboxed iframe (ingen scripts), så indholdet hverken
// arver admin-CSS eller kan køre kode.
function SandboxedHtml({ html, css }: { html: string; css: string }) {
  const doc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>${html}</body></html>`;
  return <iframe title="Forhåndsvisning" sandbox="" srcDoc={doc} className="block min-h-0 w-full flex-1 border-0 bg-transparent" />;
}

const MAIL_CSS = `
  html,body{margin:0;background:#fff;color:#1c1c1e;font:16px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}
  body{padding:4px 20px 40px;word-wrap:break-word;}
  a{color:#35784A;} img{max-width:100%;height:auto;} p{margin:0 0 12px;}
`;

export function MailPreview({ subject, html, from = "Hello Cal" }: { subject: string; html: string; from?: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white text-[#1c1c1e]">
      <div className="flex h-11 shrink-0 items-center px-4 text-[17px] text-[#007aff]">‹ Indbakke</div>
      <div className="flex shrink-0 items-center gap-3 border-b border-[#e5e5ea] px-5 pb-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-[#35784A] text-sm font-semibold text-white">HC</span>
        <div className="min-w-0 flex-1">
          <p className="flex justify-between text-[15px] font-semibold">
            {from}
            <span className="text-[13px] font-normal text-[#8e8e93]">09.41</span>
          </p>
          <p className="text-[13px] text-[#8e8e93]">Til: peter@eksempel.dk</p>
        </div>
      </div>
      <p className="shrink-0 px-5 pb-2 pt-3 text-[20px] font-bold leading-6">{fillSampleVars(subject) || "(Intet emne)"}</p>
      <SandboxedHtml html={fillSampleVars(html)} css={MAIL_CSS} />
    </div>
  );
}

export function PushPreview({ title, body }: { title: string; body: string }) {
  const text = htmlToPlainText(fillSampleVars(body));
  return (
    <div
      className="-mt-[54px] flex min-h-0 flex-1 flex-col items-center px-3 pt-[54px] text-white"
      style={{ background: "linear-gradient(160deg,#2c5d3b 0%,#35784A 45%,#1d3b27 100%)" }}
    >
      <p className="mt-6 text-[20px] font-semibold opacity-90">søndag 27. september</p>
      <p className="text-[92px] font-bold leading-none tracking-tight">9:41</p>
      <div className="mt-auto mb-24 w-full rounded-[22px] bg-white/75 p-3 text-black shadow backdrop-blur">
        <div className="flex items-start gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element -- statisk app-ikon */}
          <img src="/icons/icon-192.png" alt="" className="size-[38px] shrink-0 rounded-[9px]" />
          <div className="min-w-0 flex-1">
            <p className="flex justify-between gap-2 text-[15px] font-semibold leading-5">
              <span className="truncate">{fillSampleVars(title) || "Hello Cal"}</span>
              <span className="shrink-0 text-[13px] font-normal text-black/50">nu</span>
            </p>
            <p className="line-clamp-4 whitespace-pre-line text-[15px] leading-5">{text}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const APP_CSS = `
  html,body{margin:0;background:#FAF8F3;color:#242424;font:15px/22px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}
  body{padding:0 24px 24px;word-wrap:break-word;}
  h1,h2,h3{color:#242424;font-weight:700;margin:0 0 12px;} h1,h2{font-size:22px;line-height:28px;} h3{font-size:17px;line-height:22px;}
  a{color:#35784A;} img{max-width:100%;height:auto;border-radius:12px;} p{margin:0 0 12px;}
`;

export function FlowPagePreview({
  title,
  html,
  buttonLabel,
  step,
  total,
}: {
  title: string;
  html: string;
  buttonLabel: string;
  step: number;
  total: number;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#FAF8F3] text-[#242424]">
      <div className="flex shrink-0 items-center justify-center gap-1.5 py-3">
        {Array.from({ length: Math.max(total, 1) }, (_, index) => (
          <span
            key={index}
            className={`h-2 rounded-full ${index === step ? "w-6 bg-[#232323]" : "w-2 bg-[#DFD9CC]"}`}
          />
        ))}
      </div>
      {title && <p className="shrink-0 px-6 pb-3 pt-2 hf-type-page-title">{fillSampleVars(title)}</p>}
      <SandboxedHtml html={fillSampleVars(html)} css={APP_CSS} />
      {/* Handlingsknap som i appen (design.md §6.2): sort, radius 8, 48 px høj. */}
      <div className="shrink-0 px-4 pb-8 pt-3">
        <div className="hf-btn-primary h-12 w-full px-4">
          {buttonLabel || "Næste"}
        </div>
      </div>
    </div>
  );
}

// Lille fane-vælger over telefonen, fx "Mail / Notifikation".
export function PreviewTabs<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex gap-2" role="tablist">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
          className="hf-choice"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
