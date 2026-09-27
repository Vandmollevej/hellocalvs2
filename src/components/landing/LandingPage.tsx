import Image from "next/image";
import Link from "next/link";

// Offentlig forside for ikke-indloggede besøgende på hellocal.io (i stil med
// Instagrams tidlige "hent appen"-side): telefon med grøn skærm + logo til
// venstre, butikslinks til højre, log ind øverst til højre, neutral footer.
const APP_STORE_URL = "https://apps.apple.com/";
const PLAY_STORE_URL = "https://play.google.com/store/apps";

function StoreBadge({ href, top, bottom }: { href: string; top: string; bottom: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-14 w-48 flex-col justify-center rounded-xl bg-black px-5 text-white transition hover:bg-neutral-800"
    >
      <span className="text-[11px] leading-tight opacity-80">{top}</span>
      <span className="text-xl font-semibold leading-tight">{bottom}</span>
    </a>
  );
}

export function LandingPage() {
  return (
    <div className="fixed inset-0 z-0 flex flex-col overflow-y-auto bg-white text-neutral-900">
      <header className="flex justify-end px-4 py-4 sm:px-8">
        <Link
          href="/login"
          className="rounded-lg bg-[#067a46] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#035624]"
        >
          Log ind
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-12 px-4 py-10 md:flex-row md:gap-20">
        <div
          aria-hidden
          className="relative h-[520px] w-[260px] shrink-0 rounded-[44px] bg-neutral-900 p-3 shadow-2xl"
        >
          <div className="absolute left-1/2 top-5 h-5 w-24 -translate-x-1/2 rounded-full bg-neutral-900" style={{ zIndex: 1 }} />
          <div className="flex h-full w-full items-center justify-center rounded-[34px] bg-gradient-to-b from-[#0a8f53] to-[#035624]">
            <Image src="/hello-cal-logo-white.png" alt="" width={180} height={180} className="h-auto w-44" priority />
          </div>
        </div>

        <div className="flex max-w-sm flex-col items-center text-center md:items-start md:text-left">
          <Image src="/hello-cal-logo.png" alt="Hello Cal" width={240} height={80} className="h-auto w-56" priority />
          <p className="mt-6 text-lg text-neutral-600">
            Hold styr på kalorier, måltider, vand og vægt. Nemt, hurtigt og på dansk.
          </p>
          <p className="mt-8 text-sm font-medium text-neutral-500">Hent appen.</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <StoreBadge href={APP_STORE_URL} top="Hent i" bottom="App Store" />
            <StoreBadge href={PLAY_STORE_URL} top="Hent den på" bottom="Google Play" />
          </div>
          <p className="mt-6 text-sm text-neutral-500">
            Har du allerede en konto?{" "}
            <Link href="/login" className="font-semibold text-[#067a46] hover:underline">
              Log ind her
            </Link>
          </p>
        </div>
      </main>

      <footer className="px-4 py-6 text-xs text-neutral-500">
        <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2">
          <Link href="/betingelser" className="hover:underline">Terms and conditions</Link>
          <Link href="/om-os" className="hover:underline">About us</Link>
          <a href="mailto:support@hellocal.io" className="hover:underline">Contact</a>
        </nav>
        <p className="mt-3 text-center">© {new Date().getFullYear()} Hello Cal</p>
      </footer>
    </div>
  );
}
