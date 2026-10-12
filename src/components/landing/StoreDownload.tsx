import QRCode from "qrcode";
import { IconBrandApple, IconBrandGooglePlay } from "@tabler/icons-react";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/landing-content";

// Butiksknapper + QR-koder til App Store og Google Play. QR-koderne tegnes på
// serveren ud fra de samme links som knapperne.

// QR-biblioteket skriver farverne direkte i SVG'en og kræver hex — værdierne er
// tokens --hf-color-brand-dark og --hf-color-white (globals.css), ikke egne farver.
const QR_DARK = "#035624";
const QR_LIGHT = "#ffffff";

async function qrSvg(url: string) {
  return QRCode.toString(url, {
    type: "svg",
    margin: 0,
    errorCorrectionLevel: "M",
    color: { dark: QR_DARK, light: QR_LIGHT },
  });
}

function StoreButton({ href, store, dark }: { href: string; store: "apple" | "google"; dark?: boolean }) {
  const Icon = store === "apple" ? IconBrandApple : IconBrandGooglePlay;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`mk-store-button ${
        dark ? "mk-store-button--dark" : "mk-store-button--light"
      }`}
    >
      <Icon size={28} aria-hidden="true" />
      <span className="flex flex-col leading-tight">
        <span className="mk-type-micro opacity-75">{store === "apple" ? "Hent i" : "Hent den på"}</span>
        <span className="mk-weight-semibold mk-type-intro">{store === "apple" ? "App Store" : "Google Play"}</span>
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
      <span className="mk-weight-semibold mk-type-caption text-hf-black">{label}</span>
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
