import type { Metadata } from "next";
import Link from "next/link";
import { IconExternalLink, IconFlask } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { prisma } from "@/lib/prisma";
import {
  EU_STATUS_LABEL,
  FLAG_LABEL,
  ORIGIN_LABEL,
  canonicalENumber,
  eNumberResearchLinks,
  findENumber,
  type ENumberEntry,
} from "@/lib/e-number-catalog";

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const entry = findENumber(code);
  return { title: entry ? `${entry.code} ${entry.nameDa}` : canonicalENumber(code) };
}

// Detaljeside for ét E-nummer: egen beskrivelse, anvendelse, sundhed,
// forskning og kilder, der handler om netop dette stof (DECISIONS 2026-09-28).
export default async function ENumberDetailPage({ params }: Props) {
  const { code: rawCode } = await params;
  const entry = findENumber(rawCode);
  const requested = canonicalENumber(rawCode);
  const title = entry?.code ?? requested.replace(/\(.*\)$/, "");

  return (
    <HfScreen title={title} icon={<IconFlask size={20} stroke={2} />} alwaysShowBackButton>
      <div className="hf-page flex flex-col gap-3">
        {entry ? <EntryView entry={entry} requested={requested} /> : <Fallback code={title} />}
        <Link href="/e-numre" className="hf-type-small text-hf-green underline underline-offset-2">
          Se alle E-numre
        </Link>
        <p className="hf-type-small text-text-secondary">
          Generel baggrundsinformation baseret på EFSA, JECFA og fagfællebedømt forskning — ikke
          personlig kostrådgivning.
        </p>
      </div>
    </HfScreen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="hf-card">
      <h2 className="hf-type-small text-text-secondary hf-heading uppercase">{title}</h2>
      <div className="hf-type-body mt-1 text-hf-black">{children}</div>
    </section>
  );
}

function Chip({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "warn" | "ok" }) {
  const colors =
    tone === "warn"
      ? "bg-hf-red-muted/25 text-hf-black"
      : tone === "ok"
        ? "bg-hf-green/15 text-hf-black"
        : "bg-hf-white text-hf-black";
  return <span className={`hf-type-small rounded-full px-3 py-1 ${colors}`}>{children}</span>;
}

function EntryView({ entry, requested }: { entry: ENumberEntry; requested: string }) {
  const variant = entry.variants.find((item) => item.code === requested);
  const links = eNumberResearchLinks(entry);
  return (
    <>
      <Section title="Navn">
        <p className="hf-heading">{entry.nameDa || entry.nameEn}</p>
        {entry.nameEn && entry.nameEn !== entry.nameDa && (
          <p className="text-text-secondary">{entry.nameEn}</p>
        )}
        {variant && (
          <p className="hf-type-small mt-1 text-text-secondary">
            Du kom fra {variant.code}: {variant.nameDa || variant.nameEn}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <Chip tone={entry.euStatus === "approved" ? "ok" : "warn"}>{EU_STATUS_LABEL[entry.euStatus]}</Chip>
          {entry.category && <Chip>{entry.category}</Chip>}
          <Chip>{ORIGIN_LABEL[entry.origin]}</Chip>
          {entry.efsa?.adi && <Chip>ADI: {entry.efsa.adi}</Chip>}
        </div>
        {entry.summary && <p className="mt-3">{entry.summary}</p>}
      </Section>

      {entry.flags.length > 0 && (
        <Section title="Vær opmærksom hvis">
          <div className="flex flex-wrap gap-2">
            {entry.flags.map((flag) => (
              <Chip key={flag} tone="warn">
                {FLAG_LABEL[flag] ?? flag}
              </Chip>
            ))}
          </div>
        </Section>
      )}

      {entry.description && (
        <Section title="Hvad er det">
          <p>{entry.description}</p>
        </Section>
      )}

      {entry.variants.length > 0 && (
        <Section title="Varianter">
          <ul className="flex flex-col gap-1">
            {entry.variants.map((item) => (
              <li key={item.code} className={item.code === requested ? "hf-heading" : undefined}>
                {item.code} — {item.nameDa || item.nameEn}
                {item.nameEn && item.nameDa && item.nameEn !== item.nameDa && (
                  <span className="text-text-secondary"> ({item.nameEn})</span>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {entry.uses && (
        <Section title="Hvor findes det">
          <p>{entry.uses}</p>
        </Section>
      )}

      {entry.health && (
        <Section title="Sundhed og risici">
          <p>{entry.health}</p>
        </Section>
      )}

      {entry.research && (
        <Section title="Forskningen">
          <p>{entry.research}</p>
        </Section>
      )}

      {entry.efsa && (
        <Section title="EFSA's vurdering">
          <p>{entry.efsa.title}</p>
          <p className="hf-type-small text-text-secondary">
            {[
              entry.efsa.date && `Offentliggjort ${entry.efsa.date}`,
              entry.efsa.adi && `ADI ${entry.efsa.adi}`,
              entry.efsa.overexposureRisk && `Risiko for overskridelse: ${overexposureLabel(entry.efsa.overexposureRisk)}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </Section>
      )}

      {(entry.verification?.sources.length ?? 0) > 0 && (
        <Section title="Faktatjekket mod">
          <ul className="flex flex-col gap-1">
            {entry.verification?.sources.map((url) => (
              <li key={url} className="break-all">
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="hf-type-small text-hf-green underline underline-offset-2"
                >
                  {url.replace(/^https?:\/\/(www\.)?/, "")}
                </a>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title={`Forskning og kilder om ${entry.code}`}>
        <ul className="flex flex-col gap-2">
          {links.map((link) => (
            <li key={link.url}>
              <a
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-start gap-1 text-hf-green underline underline-offset-2"
              >
                <span>{link.label}</span>
                <IconExternalLink size={14} className="mt-1 shrink-0" />
              </a>
              <p className="hf-type-small text-text-secondary">{link.description}</p>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}

function overexposureLabel(value: string) {
  const risk = value.replace(/^en:/, "");
  if (risk === "high") return "høj";
  if (risk === "moderate") return "moderat";
  if (risk === "no") return "ingen";
  return risk;
}

// E-numre uden for kataloget: vis databasens række, hvis den findes.
async function Fallback({ code }: { code: string }) {
  const row = await prisma.additive.findUnique({ where: { eNumber: code } }).catch(() => null);
  if (!row) {
    return (
      <Section title="Ikke i opslagsværket">
        <p>
          {code} er ikke et E-nummer, vi kender. Tjek stavningen på varen — eller søg på listen over
          alle E-numre.
        </p>
      </Section>
    );
  }
  return (
    <>
      <Section title="Navn">
        <p className="hf-heading">{row.internationalName}</p>
        {row.danishName && <p className="text-text-secondary">{row.danishName}</p>}
      </Section>
      {row.function && (
        <Section title="Hvad er det">
          <p>{row.function}</p>
        </Section>
      )}
      {row.risks && (
        <Section title="Sundhed og risici">
          <p>{row.risks}</p>
        </Section>
      )}
      {row.research && (
        <Section title="Forskningen">
          <p>{row.research}</p>
        </Section>
      )}
    </>
  );
}
