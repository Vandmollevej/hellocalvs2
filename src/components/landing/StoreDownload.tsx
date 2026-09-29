import QRCode from "qrcode";
import { IconBrandApple, IconBrandGooglePlay } from "@tabler/icons-react";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/landing-content";

// Butiksknapper + QR-koder til App Store og Google Play. QR-koderne tegnes på
// serveren ud fra de samme links som knapperne.

async function qrSvg(url: string) {
  return QRCode.toString(url, {
    type: "svg",
    margin: 0,
    errorCorrectionLevel: "M",
    color: { dark: "#035624", light: "#ffffff" },
  });
}

function StoreButton({ href, store, dark }: { href: string; store: "apple" | "google"; dark?: boolean }) {
  const Icon = store === "apple" ? IconBrandApple : IconBrandGooglePlay;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex h-14 w-[184px] items-center gap-3 rounded-xl px-4 transition ${
        dark ? "bg-hf-black text-hf-white hover:bg-[#353535]" : "bg-hf-white text-hf-black hover:bg-hf-cream"
      }`}
    >
      <Icon size={28} aria-hidden="true" />
      <span className="flex flex-col leading-tight">
        <span className="text-[11px] opacity-75">{store === "apple" ? "Hent i" : "Hent den på"}</span>
        <span className="text-lg font-semibold">{store === "apple" ? "App Store" : "Google Play"}</span>
      </span>
    </a>
  );
}

function QrTile({ svg, label, href }: { svg: string; label: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex w-[120px] flex-col items-center gap-2 rounded-2xl bg-hf-white p-3 text-center shadow-sm transition hover:-translate-y-0.5"
      aria-label={`QR-kode til ${label}`}
    >
      <span className="block h-[94px] w-[94px] [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
      <span className="text-xs font-semibold text-hf-black">{label}</span>
    </a>
  );
}

export async function StoreDownload({ variant = "light", withQr = true }: { variant?: "light" | "dark"; withQr?: boolean }) {
  const [appleQr, googleQr] = withQr ? await Promise.all([qrSvg(APP_STORE_URL), qrSvg(PLAY_STORE_URL)]) : ["", ""];
  const dark = variant === "dark";
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
      <div className="flex flex-col gap-3">
        <StoreButton href={APP_STORE_URL} store="apple" dark={dark} />
        <StoreButton href={PLAY_STORE_URL} store="google" dark={dark} />
      </div>
      {withQr && (
        <div className="hidden gap-3 sm:flex">
          <QrTile svg={appleQr} label="App Store" href={APP_STORE_URL} />
          <QrTile svg={googleQr} label="Google Play" href={PLAY_STORE_URL} />
        </div>
      )}
    </div>
  );
}
