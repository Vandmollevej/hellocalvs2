import { IconCheck, IconQuote, IconStarFilled, IconStethoscope } from "@tabler/icons-react";
import { MarketingShell, SectionHeading } from "@/components/landing/MarketingShell";
import { StoreDownload } from "@/components/landing/StoreDownload";
import { LandingPlans } from "@/components/landing/LandingPlans";
import {
  AppScreensRow,
  HelloDocScreens,
  LandingIconGlyph,
  TodayOverlayCard,
  WeightChartBackdrop,
} from "@/components/landing/LandingVisuals";
import {
  FAQ,
  FEATURES_LEFT,
  FEATURES_RIGHT,
  HIGHLIGHTS,
  LANDING_NAV,
  PLANS,
  PRESS_MENTIONS,
} from "@/lib/landing-content";
import { getLandingStats } from "@/lib/landing-stats";

// Offentlig forside for ikke-indloggede besøgende (docs/DECISIONS.md
// 2026-09-29): hent-appen-side i Hello Cal-farver med butikslinks + QR-koder,
// "Log ind" øverst til højre og Business/Presse i footeren. Ingen telefonramme.

function FeatureItem({ icon, title, text, align }: (typeof FEATURES_LEFT)[number] & { align: "left" | "right" }) {
  return (
    <div className={`flex items-start gap-4 ${align === "right" ? "lg:flex-row-reverse lg:text-right" : ""}`}>
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-hf-white text-hf-green shadow-sm">
        <LandingIconGlyph icon={icon} />
      </span>
      <div>
        <h3 className="text-lg font-bold text-hf-white">{title}</h3>
        <p className="mt-1 text-[15px] leading-relaxed text-hf-white/80">{text}</p>
      </div>
    </div>
  );
}

function Stars({ value, max }: { value: number; max: number }) {
  return (
    <span className="flex items-center gap-0.5 text-hf-green" aria-label={`${value} af ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <IconStarFilled key={i} size={16} aria-hidden="true" className={i < Math.round(value) ? "" : "opacity-25"} />
      ))}
    </span>
  );
}

export async function LandingPage() {
  const stats = await getLandingStats();
  const nav = LANDING_NAV.filter((item) => item.href !== "#medier" || PRESS_MENTIONS.length > 0);

  return (
    <MarketingShell nav={[...nav]}>
      {/* Hero: tekst + butikker til venstre, bundark-overlay over en vægtgraf til højre. */}
      <section className="mk-hero-bg relative overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-hf-white/5" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 left-1/3 h-80 w-80 rounded-full bg-hf-white/5" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-32 pt-16 sm:px-6 lg:grid-cols-2 lg:pb-40 lg:pt-24">
          <div>
            <p className="mk-eyebrow">Kalorietæller på dansk</p>
            <h1 className="mt-4 text-4xl font-bold leading-tight sm:text-5xl">
              Hold styr på kalorierne — <span className="text-hf-positive">uden besvær</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-hf-white/85">
              Scan maden, følg vand og vægt, og se din udvikling i grafer der giver mening. Hello Cal gør det nemt at
              nå dine mål.
            </p>
            <div id="hent" className="mt-10 scroll-mt-24">
              <StoreDownload />
            </div>
          </div>
          <div className="relative flex min-h-[380px] items-center justify-center">
            <WeightChartBackdrop className="absolute inset-0 h-full w-full" />
            <div className="relative lg:translate-x-10 lg:translate-y-10">
              <TodayOverlayCard />
            </div>
          </div>
        </div>
      </section>

      {/* Fire kort der ligger hen over hero-kanten. */}
      <div className="relative z-10 mx-auto -mt-20 grid max-w-6xl grid-cols-2 gap-4 px-4 sm:px-6 lg:grid-cols-4 lg:gap-6">
        {HIGHLIGHTS.map((h) => (
          <div key={h.title} className="flex flex-col items-center gap-4 rounded-2xl bg-hf-white px-4 py-8 text-center shadow-[0_20px_50px_-24px_rgba(0,0,0,0.35)]">
            <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-hf-green text-hf-green">
              <LandingIconGlyph icon={h.icon} />
            </span>
            <p className="text-sm font-bold uppercase tracking-wide text-hf-black">{h.title}</p>
          </div>
        ))}
      </div>

      <section id="om" className="scroll-mt-20 px-4 py-24 sm:px-6">
        <SectionHeading
          title="Om"
          accent="Hello Cal"
          text="En dansk app til kalorie- og måltidsregistrering — bygget til at være hurtig i hverdagen og ærlig om dine data."
        />
        <div className="mx-auto mt-14 grid max-w-6xl items-center gap-12 lg:grid-cols-2">
          <div>
            <h3 className="text-2xl font-bold text-hf-black">Et overblik du faktisk bruger</h3>
            <p className="mt-4 leading-relaxed text-text-secondary">
              Registrér et måltid på få sekunder: scan stregkoden, søg i databasen eller vælg fra dine egne retter.
              Hello Cal regner kalorier og næring ud for dig og viser, hvor du står i dag.
            </p>
            <p className="mt-4 leading-relaxed text-text-secondary">
              Over tid samler graferne det hele — kalorier, vægt og vand — så du kan se, hvad der virker for dig.
            </p>
            <a
              href="#hent"
              className="mt-8 mk-btn mk-btn--brand"
            >
              Hent appen
            </a>
          </div>
          {/* Plads til billede af badevægt senere (brugerens plan 2026-09-29). */}
          <div className="mk-hero-bg relative overflow-hidden rounded-3xl p-8">
            <WeightChartBackdrop className="h-64 w-full" />
            <div className="absolute bottom-6 left-6 rounded-2xl bg-hf-white px-4 py-3 shadow-lg">
              <p className="text-xs text-text-secondary">Vægt, seneste 3 måneder</p>
              <p className="text-xl font-bold text-hf-green">−5,2 kg</p>
            </div>
          </div>
        </div>
      </section>

      <section id="funktioner" className="mk-hero-bg scroll-mt-20 px-4 py-24 sm:px-6">
        <SectionHeading
          light
          title="Alt det"
          accent="du har brug for"
          text="Fra første scanning til månedens statistik — samlet ét sted."
        />
        <div className="mx-auto mt-16 grid max-w-6xl items-center gap-10 lg:grid-cols-[1fr_auto_1fr]">
          <div className="flex flex-col gap-10">
            {FEATURES_LEFT.map((f) => (
              <FeatureItem key={f.title} {...f} align="right" />
            ))}
          </div>
          <div className="flex justify-center">
            <TodayOverlayCard />
          </div>
          <div className="flex flex-col gap-10">
            {FEATURES_RIGHT.map((f) => (
              <FeatureItem key={f.title} {...f} align="left" />
            ))}
          </div>
        </div>
      </section>

      <section id="skaermbilleder" className="scroll-mt-20 py-24">
        <div className="px-4 sm:px-6">
          <SectionHeading title="Se" accent="appen" text="Sådan ser Hello Cal ud i hverdagen." />
          <div className="mt-8 flex justify-center">
            <StoreDownload variant="dark" withQr={false} />
          </div>
        </div>
        <div className="mt-12">
          <AppScreensRow />
        </div>
      </section>

      {stats && (
        <section className="bg-hf-cream px-4 py-20 sm:px-6">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
            {stats.map((s) => (
              <div key={s.key} className="rounded-2xl bg-hf-white px-4 py-8 text-center shadow-[0_20px_50px_-30px_rgba(0,0,0,0.35)]">
                <p className="text-4xl font-bold text-hf-green">{s.value.toLocaleString("da-DK")}</p>
                <p className="mt-2 text-sm font-semibold uppercase tracking-wide text-text-secondary">{s.label}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section id="hello-doc" className="scroll-mt-20 bg-hf-green-dark px-4 py-24 text-hf-white sm:px-6">
        <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2">
          <div>
            <p className="flex items-center gap-2 mk-eyebrow">
              <IconStethoscope size={18} aria-hidden="true" /> Hello Doc
            </p>
            <h2 className="mt-4 text-3xl font-bold sm:text-4xl">Del din fremgang med lægen eller diætisten</h2>
            <p className="mt-5 leading-relaxed text-hf-white/80">
              Med Hello Doc inviterer du din behandler til at se præcis de data, du vælger — i den periode du vælger.
              Du kan altid trække adgangen tilbage.
            </p>
            <ul className="mt-6 flex flex-col gap-3">
              {["Du bestemmer hvilke data der deles", "Overskuelige grafer og nøgletal", "Adgang uden app eller konto for behandleren"].map((t) => (
                <li key={t} className="flex items-center gap-3">
                  <IconCheck size={20} className="shrink-0 text-hf-positive" aria-hidden="true" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-hf-white/60">Hello Doc er en del af Seriøs.</p>
          </div>
          <div className="pb-10">
            <HelloDocScreens />
          </div>
        </div>
      </section>

      <section
        id="priser"
        className="scroll-mt-20 px-4 py-24 sm:px-6 mk-hero-bg--vertical"
      >
        <SectionHeading light title="Vælg din" accent="plan" text="Start gratis. Opgradér når du vil have hele historikken og statistikken." />
        <div className="mx-auto mt-16 max-w-6xl">
          <LandingPlans plans={PLANS} />
        </div>
        <div className="mx-auto mt-20 grid max-w-6xl gap-10 text-hf-white lg:grid-cols-3">
          <div>
            <h2 className="text-3xl font-bold">Spørgsmål og svar</h2>
            <p className="mt-3 text-hf-white/75">De ting vi oftest bliver spurgt om.</p>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:col-span-2">
            {FAQ.map((f) => (
              <div key={f.q}>
                <h3 className="text-lg font-bold">{f.q}</h3>
                <p className="mt-2 leading-relaxed text-hf-white/80">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {PRESS_MENTIONS.length > 0 && (
        <section id="medier" className="scroll-mt-20 bg-hf-cream px-4 py-24 sm:px-6">
          <SectionHeading title="Hello Cal" accent="i medierne" text="Hvad andre skriver om appen." />
          <div className="mx-auto mt-14 grid max-w-5xl gap-6 md:grid-cols-2">
            {PRESS_MENTIONS.map((m) => (
              <figure key={`${m.outlet}-${m.quote}`} className="rounded-2xl bg-hf-white p-8 text-center shadow-sm">
                <IconQuote size={40} className="mx-auto text-hf-green-light" aria-hidden="true" />
                <blockquote className="mt-4 leading-relaxed text-text-secondary">{m.quote}</blockquote>
                <figcaption className="mt-5 flex flex-col items-center gap-2">
                  {m.rating && <Stars value={m.rating.value} max={m.rating.max} />}
                  {m.url ? (
                    <a href={m.url} target="_blank" rel="noopener noreferrer" className="font-bold text-hf-black hover:underline">
                      {m.outlet}
                    </a>
                  ) : (
                    <span className="font-bold text-hf-black">{m.outlet}</span>
                  )}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      <section className="px-4 py-24 sm:px-6">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-8 rounded-3xl bg-hf-cream px-6 py-14 text-center">
          <h2 className="text-3xl font-bold text-hf-black sm:text-4xl">
            Hent <span className="text-hf-green">Hello Cal</span> i dag
          </h2>
          <p className="max-w-xl text-text-secondary">Scan QR-koden med telefonens kamera, eller tryk på din butik.</p>
          <StoreDownload variant="dark" />
        </div>
      </section>
    </MarketingShell>
  );
}
