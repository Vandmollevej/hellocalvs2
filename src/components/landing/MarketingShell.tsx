import Image from "next/image";
import Link from "next/link";

// Fælles ramme for de offentlige sider (forside, Business, Presse): fuld
// browserbredde uden app-skal eller telefonramme, menu øverst med "Log ind" i
// højre hjørne og footer med Business og Presse.

// "/" ligger i desktop-skallen (WebShell), fordi samme sti er appens forside
// for indloggede: skjul skallens sidebjælke og topbjælke, og fjern
// indholdsfladens bredde- og transform-grænse, så position: fixed rammer hele
// skærmen. /business og /presse vises allerede i fuld viewport (AppFrame).
const SHELL_OVERRIDES =
  ".web-shell>aside,.web-shell>div>header{display:none}.web-shell-content{max-width:none!important;transform:none!important}";

export type MarketingNavItem = { href: string; label: string };

export function MarketingShell({ nav = [], children }: { nav?: MarketingNavItem[]; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto scroll-smooth bg-hf-white text-hf-black">
      <style>{SHELL_OVERRIDES}</style>
      <header className="sticky top-0 z-40 border-b border-black/5 bg-hf-white/95 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link href="/" aria-label="Hello Cal — forside" className="shrink-0">
            <Image src="/hello-cal-logo.png" alt="Hello Cal" width={150} height={50} className="h-auto w-[132px]" priority />
          </Link>
          <nav className="ml-auto hidden items-center gap-7 lg:flex" aria-label="Sider">
            {nav.map((item) => (
              <a key={item.href} href={item.href} className="text-[15px] text-text-secondary transition hover:text-hf-green">
                {item.label}
              </a>
            ))}
          </nav>
          <Link
            href="/login"
            className="ml-auto rounded-full bg-hf-green px-6 py-2.5 text-sm font-semibold text-hf-white transition hover:bg-hf-green-dark lg:ml-0"
          >
            Log ind
          </Link>
        </div>
      </header>

      {children}

      <MarketingFooter />
    </div>
  );
}

function MarketingFooter() {
  return (
    <footer className="bg-hf-green-dark text-hf-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <Image src="/hello-cal-logo-white.png" alt="Hello Cal" width={150} height={50} className="h-auto w-[132px]" />
          <p className="mt-4 max-w-sm text-sm text-hf-white/75">
            Kalorier, måltider, vand og vægt — nemt, hurtigt og på dansk.
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-hf-green-light">For virksomheder</p>
          <ul className="mt-4 flex flex-col gap-2 text-sm">
            <li>
              <Link href="/business" className="text-hf-white/85 hover:text-hf-white hover:underline">
                Business-partnere
              </Link>
            </li>
            <li>
              <Link href="/presse" className="text-hf-white/85 hover:text-hf-white hover:underline">
                Presse
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-hf-green-light">Hello Cal</p>
          <ul className="mt-4 flex flex-col gap-2 text-sm">
            <li>
              <Link href="/login" className="text-hf-white/85 hover:text-hf-white hover:underline">
                Log ind
              </Link>
            </li>
            <li>
              <Link href="/betingelser" className="text-hf-white/85 hover:text-hf-white hover:underline">
                Vilkår og betingelser
              </Link>
            </li>
            <li>
              <Link href="/privatlivspolitik" className="text-hf-white/85 hover:text-hf-white hover:underline">
                Privatlivspolitik
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-hf-white/10">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-hf-white/60 sm:px-6">© {new Date().getFullYear()} Hello Cal</p>
      </div>
    </footer>
  );
}

export function SectionHeading({ title, accent, text, light }: { title: string; accent?: string; text?: string; light?: boolean }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <h2 className={`text-3xl font-bold sm:text-4xl ${light ? "text-hf-white" : "text-hf-black"}`}>
        {title} {accent && <span className={light ? "text-hf-green-light" : "text-hf-green"}>{accent}</span>}
      </h2>
      {text && <p className={`mt-4 text-base leading-relaxed ${light ? "text-hf-white/80" : "text-text-secondary"}`}>{text}</p>}
    </div>
  );
}
