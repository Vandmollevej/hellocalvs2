import Image from "next/image";
import Link from "next/link";

// Offentlig forside for ikke-indloggede besøgende på hellocal.io. Appen er
// det primære mål (som på fx Instagram, Lifesum og HelloFresh): hero med
// butiksknapper først, telefon-mockup, korte fordele og en fast "Hent appen"-
// bjælke nederst på mobil. Mobile-first; farver efter design.md.
const APP_STORE_URL = "https://apps.apple.com/";
const PLAY_STORE_URL = "https://play.google.com/store/apps";

const FEATURES = [
  { title: "Kalorier og måltider", text: "Scan stregkoden, tag et foto eller søg. Din dag er registreret på få sekunder.", icon: "M4 19V9m6 10V5m6 14v-7m4 7H2" },
  { title: "Vand og vægt", text: "Følg væske, vægt og kropsmål og se udviklingen over tid.", icon: "M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z" },
  { title: "Dit mål, din plan", text: "Sæt en målsætning og se med det samme, om du er inden for dagens ramme.", icon: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-5a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" },
  { title: "Privat og på dansk", text: "Ingen annoncesporing og ingen datasalg. Dine data er dine.", icon: "M6 11V8a6 6 0 1 1 12 0v3M5 11h14v10H5V11Z" },
];

function StoreBadge({ href, top, bottom }: { href: string; top: string; bottom: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-14 w-full items-center justify-center gap-3 rounded-lg bg-[#232323] px-5 text-white transition hover:bg-[#353535] active:bg-[#4b4b4b] sm:w-52"
    >
      <span className="flex flex-col text-left">
        <span className="text-[11px] leading-tight opacity-80">{top}</span>
        <span className="text-xl font-semibold leading-tight">{bottom}</span>
      </span>
    </a>
  );
}

function StoreButtons() {
  return (
    <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
      <StoreBadge href={APP_STORE_URL} top="Hent i" bottom="App Store" />
      <StoreBadge href={PLAY_STORE_URL} top="Hent den på" bottom="Google Play" />
    </div>
  );
}

function PhoneMockup() {
  return (
    <div
      aria-hidden
      className="relative mx-auto h-[440px] w-[220px] shrink-0 rounded-[40px] bg-neutral-900 p-2.5 shadow-2xl sm:h-[520px] sm:w-[260px] sm:rounded-[44px] sm:p-3"
    >
      <div className="absolute left-1/2 top-4 z-10 h-4 w-20 -translate-x-1/2 rounded-full bg-neutral-900 sm:top-5 sm:h-5 sm:w-24" />
      <div className="flex h-full w-full flex-col items-center justify-center gap-6 rounded-[30px] bg-gradient-to-b from-[#0a8f53] to-[#035624] sm:rounded-[34px]">
        <Image src="/hello-cal-logo-white.png" alt="" width={180} height={180} className="h-auto w-32 sm:w-40" priority />
        <div className="flex w-3/4 flex-col gap-2">
          <div className="h-2.5 w-full rounded-full bg-white/25"><div className="h-full w-2/3 rounded-full bg-white" /></div>
          <div className="h-2.5 w-full rounded-full bg-white/25"><div className="h-full w-1/3 rounded-full bg-white" /></div>
          <div className="h-2.5 w-full rounded-full bg-white/25"><div className="h-full w-5/6 rounded-full bg-white" /></div>
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="fixed inset-0 z-0 overflow-y-auto bg-[#faf8f3] text-[#242424]">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[#dfd9cc] bg-[#faf8f3]/95 px-4 py-3 backdrop-blur sm:px-8">
        <Image src="/hello-cal-logo.png" alt="Hello Cal" width={240} height={80} className="h-auto w-28 sm:w-32" priority />
        <Link
          href="/login"
          className="flex h-11 items-center rounded-lg border border-[#232323] px-5 text-sm font-semibold transition hover:bg-[#eee9df]"
        >
          Log ind
        </Link>
      </header>

      <main>
        <section className="mx-auto flex w-full max-w-5xl flex-col items-center gap-10 px-4 pb-14 pt-10 text-center md:flex-row md:gap-20 md:pb-20 md:pt-16 md:text-left">
          <div className="flex w-full max-w-md flex-col items-center md:items-start">
            <h1 className="text-[32px] font-bold leading-10 tracking-tight sm:text-5xl sm:leading-[1.1]">
              Kalorietælling, der faktisk er nem.
            </h1>
            <p className="mt-4 text-base leading-6 text-[#656565] sm:text-lg">
              Hold styr på kalorier, måltider, vand og vægt. Hurtigt, privat og på dansk.
            </p>
            <p className="mt-8 text-sm font-semibold text-[#067a46]">Gratis at hente</p>
            <div className="mt-3 flex w-full justify-center md:justify-start">
              <StoreButtons />
            </div>
            <p className="mt-6 text-sm text-[#656565]">
              Har du allerede en konto?{" "}
              <Link href="/login" className="font-semibold text-[#067a46] hover:underline">
                Log ind her
              </Link>
            </p>
          </div>
          <PhoneMockup />
        </section>

        <section className="bg-[#eee9df] px-4 py-14 sm:py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-2xl font-bold leading-8 sm:text-3xl">Alt du skal bruge, i lommen</h2>
            <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f) => (
                <li key={f.title} className="rounded-lg bg-white p-5">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#067a46]/10">
                    <svg viewBox="0 0 24 24" className="h-6 w-6 text-[#067a46]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d={f.icon} />
                    </svg>
                  </span>
                  <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
                  <p className="mt-1 text-sm leading-5 text-[#656565]">{f.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="bg-[#067a46] px-4 py-14 text-center text-white sm:py-20">
          <h2 className="text-2xl font-bold leading-8 sm:text-3xl">Klar til at sige hello?</h2>
          <p className="mx-auto mt-3 max-w-md text-base opacity-90">Hent Hello Cal og kom i gang på under et minut.</p>
          <div className="mt-8 flex justify-center">
            <StoreButtons />
          </div>
        </section>
      </main>

      <footer className="px-4 pb-28 pt-6 text-xs text-[#656565] md:pb-6">
        <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2">
          <Link href="/betingelser" className="hover:underline">Terms and conditions</Link>
          <Link href="/privatlivspolitik" className="hover:underline">Privacy</Link>
          <Link href="/om-os" className="hover:underline">About us</Link>
          <a href="mailto:support@hellocal.io" className="hover:underline">Contact</a>
        </nav>
        <p className="mt-3 text-center">© {new Date().getFullYear()} Hello Cal</p>
      </footer>

      {/* Fast hent-bjælke på mobil, så appen altid er ét tryk væk. */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-[#dfd9cc] bg-[#faf8f3] px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 md:hidden">
        <span className="text-sm font-semibold">Hent Hello Cal</span>
        <div className="flex gap-2">
          <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" className="flex h-11 items-center rounded-lg bg-[#232323] px-4 text-sm font-semibold text-white">App Store</a>
          <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer" className="flex h-11 items-center rounded-lg bg-[#232323] px-4 text-sm font-semibold text-white">Google Play</a>
        </div>
      </div>
    </div>
  );
}
