import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { computePersonaAggregates, getLatestPersonaSnapshot, listPersonaSnapshots } from "@/lib/personas";
import {
  AGE_BUCKET_LABEL,
  PERSONA_DIMENSIONS,
  USAGE_PATTERN_LABEL,
  countryName,
  languageName,
  weekdayLabel,
  type PersonaDimension,
  type PersonaGroup,
} from "@/lib/persona-groups";
import { InsightKpi } from "@/components/hf/HelloDocInsight";
import { StatsBarChart } from "@/components/admin/stats/StatsBarChart";
import { PersonaRecompute } from "@/components/admin/personas/PersonaRecompute";

// Admin → Brugere → Personas (docs/DECISIONS.md 2026-10-02): anonyme
// gruppetal pr. land, by, sprog, alder, køn, abonnement og enhed (beregnes
// live) + AI-modellens personas fra det seneste snapshot (natligt cronjob
// "personas" eller "Beregn nu"). Grupper under MIN_GROUP_SIZE vises som
// "Øvrige". Logik: src/lib/personas.ts, src/lib/persona-groups.ts.

export const dynamic = "force-dynamic";

const num = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 1 });
const pct = (value: number) => `${Math.round(value * 100)} %`;

function isDimension(value: unknown): value is PersonaDimension {
  return PERSONA_DIMENSIONS.some((d) => d.key === value);
}

function formatWhen(date: Date) {
  return new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Copenhagen" }).format(date);
}

export default async function AdminPersonasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const params = await searchParams;
  const dimension: PersonaDimension = isDimension(params.dim) ? params.dim : "country";

  const [live, snapshot, history] = await Promise.all([
    computePersonaAggregates(),
    getLatestPersonaSnapshot(),
    listPersonaSnapshots(),
  ]);
  const groups = live.dimensions[dimension];
  const personas = snapshot?.personas ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="hf-type-title text-hf-black">Personas</h1>
          <p className="hf-type-body text-text-secondary">
            Brugergrupper og deres mønstre: hvor de er, hvilket sprog, alder og køn de har, hvor ofte de logger ind,
            hvornår, og hvordan de bruger appen. AI&apos;en får kun gruppetal — aldrig navne, e-mails eller id&apos;er.
          </p>
        </div>
        <PersonaRecompute canRun={admin.adminAccessLevel === "FULL"} hasSnapshot={snapshot !== null} />
      </div>

      <div className="hf-insight__kpis">
        <InsightKpi label="Brugere i grundlaget" value={num.format(live.userCount)} />
        <InsightKpi label="Aktive sidste 30 dage" value={`${num.format(live.totals.activeUsers30d)} (${pct(live.userCount ? live.totals.activeUsers30d / live.userCount : 0)})`} />
        <InsightKpi label="Betalende" value={num.format(live.totals.payingUsers)} />
        <InsightKpi label="Lande / byer / sprog" value={`${live.totals.countries} / ${live.totals.cities} / ${live.totals.languages}`} />
      </div>

      <Section
        title="AI-personas"
        intro={
          snapshot
            ? `Seneste beregning ${formatWhen(snapshot.createdAt)} (${snapshot.source === "cron" ? "natligt cronjob" : "manuel"}, ${num.format(snapshot.userCount)} brugere${snapshot.model ? `, ${snapshot.model}` : ""}). Cronjobbet "Personas" kører hver nat kl. 04:00 (kan ændres under Indstillinger → Cronjobs).`
            : "Ingen beregning endnu. Tryk \"Beregn personas med AI\" eller vent på det natlige cronjob (kl. 04:00)."
        }
      >
        {snapshot?.error && (
          <p className="hf-type-body rounded-lg bg-hf-tan p-3 text-hf-red-dark">
            Seneste beregning fejlede: {snapshot.error}. Gruppetallene nedenfor er stadig opdaterede.
          </p>
        )}
        {personas && personas.personas.length > 0 && (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {personas.personas.map((persona) => (
              <section key={persona.name} className="hf-panel">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="hf-type-title">{persona.name}</h3>
                  <span className="hf-type-caption whitespace-nowrap text-text-muted">ca. {num.format(persona.share_pct)} %</span>
                </div>
                <p className="hf-type-body text-text-primary">{persona.summary}</p>
                <dl className="hf-type-small grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-text-secondary">
                  <dt className="font-semibold text-text-primary">Hvem</dt>
                  <dd>{persona.demographics}</dd>
                  <dt className="font-semibold text-text-primary">Adfærd</dt>
                  <dd>{persona.behaviour}</dd>
                </dl>
                <BulletList title="Mønstre" items={persona.patterns} />
                <BulletList title="Behov" items={persona.needs} />
                <BulletList title="Handlinger for Hello Cal" items={persona.actions} />
              </section>
            ))}
          </div>
        )}
        {personas && (personas.key_findings.length > 0 || personas.data_caveats.length > 0) && (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <section className="hf-panel">
              <BulletList title="Vigtigste fund" items={personas.key_findings} />
            </section>
            <section className="hf-panel">
              <BulletList title="Forbehold for data" items={personas.data_caveats} />
            </section>
          </div>
        )}
      </Section>

      <Section
        title="Grupper"
        intro={`Beregnet nu. Logins tælles over de sidste 90 dage (registreret siden 27.9.2026), brug af appen over de sidste 30 dage. Grupper under ${live.minGroupSize} brugere samles i "Øvrige".`}
      >
        <div className="flex flex-wrap gap-2">
          {PERSONA_DIMENSIONS.map((d) => (
            <Link
              key={d.key}
              href={`/admin/users/personas?dim=${d.key}`}
              className={`hf-choice ${d.key === dimension ? "is-selected" : ""}`}
              aria-current={d.key === dimension ? "page" : undefined}
            >
              {d.label}
            </Link>
          ))}
        </div>
        <GroupTable groups={groups} firstColumn={PERSONA_DIMENSIONS.find((d) => d.key === dimension)?.label ?? "Gruppe"} />
      </Section>

      <Section
        title="Adfærdssegmenter"
        intro="Inddeling efter hvor mange dage i den seneste måned brugeren har logget mad, og hvornår brugeren sidst var inde."
      >
        <GroupTable
          groups={live.segments}
          firstColumn="Segment"
          extra={(group) => {
            const segment = live.segments.find((s) => s.key === group.key);
            return segment
              ? [segment.topCountry ? countryName(segment.topCountry) : "—", segment.topDevice ?? "—"]
              : ["—", "—"];
          }}
          extraHead={["Hyppigste land", "Hyppigste enhed"]}
        />
      </Section>

      <Section title="Hvornår logger brugerne ind?" intro="Alle logins de sidste 90 dage, dansk tid.">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Card title="Pr. time på døgnet">
            <StatsBarChart
              points={live.crossTabs.loginsByHour.map((value, hour) => ({
                key: String(hour),
                label: `${String(hour).padStart(2, "0")}`,
                values: { logins: value },
              }))}
              series={[{ key: "logins", label: "Log-ins", color: "var(--hf-color-brand)" }]}
              emptyText="Ingen logins registreret endnu"
            />
          </Card>
          <Card title="Pr. ugedag">
            <StatsBarChart
              points={live.crossTabs.loginsByWeekday.map((value, day) => ({
                key: String(day),
                label: weekdayLabel(day),
                values: { logins: value },
              }))}
              series={[{ key: "logins", label: "Log-ins", color: "var(--hf-color-brand)" }]}
              emptyText="Ingen logins registreret endnu"
            />
          </Card>
        </div>
      </Section>

      <Section title="Abonnement pr. aldersgruppe">
        <SimpleTable
          head={["Alder", "Gratis", "Seriøs", "Seriøs Familie"]}
          rows={live.crossTabs.tierByAge.map((row) => ({
            label: AGE_BUCKET_LABEL[row.age],
            values: [row.free, row.serious, row.family],
          }))}
          empty={`Ingen aldersgruppe har ${live.minGroupSize} brugere endnu`}
        />
      </Section>

      <Section title="Sprog pr. land">
        <SimpleTable
          head={["Land", "Sprog"]}
          rows={live.crossTabs.languageByCountry.map((row) => ({
            label: countryName(row.country),
            values: [
              Object.entries(row.languages)
                .sort((a, b) => b[1] - a[1])
                .map(([code, n]) => `${languageName(code)} ${num.format(n)}`)
                .join(" · "),
            ],
          }))}
          empty={`Intet land har ${live.minGroupSize} brugere endnu`}
        />
      </Section>

      <Section title="Tidligere beregninger">
        <SimpleTable
          head={["Tidspunkt", "Kilde", "Brugere", "Model", "Resultat"]}
          rows={history.map((row) => ({
            label: formatWhen(row.createdAt),
            values: [
              row.source === "cron" ? "Cronjob" : "Manuel",
              row.userCount,
              row.model ?? "—",
              row.error ? `Fejl: ${row.error}` : `OK${row.durationMs ? ` (${num.format(row.durationMs / 1000)} s)` : ""}`,
            ],
          }))}
          empty="Ingen beregninger endnu"
          alignRight={false}
        />
      </Section>
    </div>
  );
}

function Section({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="border-b border-border-strong pb-1 text-base font-semibold text-hf-green-dark">{title}</h2>
      {intro && <p className="hf-type-small text-text-secondary">{intro}</p>}
      {children}
    </section>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border-strong bg-surface-2 p-4">
      <p className="text-sm font-semibold text-text-primary">{title}</p>
      {children}
    </div>
  );
}

function BulletList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <p className="hf-type-small font-semibold text-text-primary">{title}</p>
      <ul className="hf-type-small list-disc pl-5 text-text-secondary">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

const GROUP_HEAD = [
  "Brugere",
  "Andel",
  "Logins / 90 d",
  "Login-dage / 90 d",
  "Aktive 30 d",
  "Reg. / 30 d",
  "Aktive dage / 30 d",
  "Betalende",
  "Smartur",
  "Vejer sig",
  "Motion",
  "Inaktive",
  "Weekend",
  "Typisk tidspunkt",
  "Toptime",
  "Topdag",
  "Kvinder",
];

function GroupTable({
  groups,
  firstColumn,
  extra,
  extraHead = [],
}: {
  groups: PersonaGroup[];
  firstColumn: string;
  extra?: (group: PersonaGroup) => (string | number)[];
  extraHead?: string[];
}) {
  return (
    <SimpleTable
      head={[firstColumn, ...GROUP_HEAD, ...extraHead]}
      rows={groups.map((g) => ({
        label: g.label,
        values: [
          g.users,
          pct(g.share),
          g.avgLogins90d,
          g.avgLoginDays90d,
          pct(g.activeShare30d),
          g.avgRegistrations30d,
          g.avgActiveDays30d,
          pct(g.payingShare),
          pct(g.integrationShare),
          pct(g.weighInShare),
          pct(g.activityShare),
          pct(g.dormantShare),
          pct(g.weekendShare),
          USAGE_PATTERN_LABEL[g.usagePattern],
          g.peakHour === null ? "—" : `${String(g.peakHour).padStart(2, "0")}–${String((g.peakHour + 1) % 24).padStart(2, "0")}`,
          weekdayLabel(g.peakWeekday),
          pct(g.femaleShare),
          ...(extra ? extra(g) : []),
        ],
      }))}
      empty="Ingen brugere endnu"
    />
  );
}

function SimpleTable({
  head,
  rows,
  empty,
  alignRight = true,
}: {
  head: string[];
  rows: { label: string; values: (string | number)[] }[];
  empty: string;
  alignRight?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border-strong bg-surface-1">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-strong bg-surface-2 text-left text-xs text-text-secondary">
            {head.map((h, i) => (
              <th key={h} className={`whitespace-nowrap px-3 py-2 font-medium ${i > 0 && alignRight ? "text-right" : ""}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={head.length} className="px-3 py-3 text-text-muted">
                {empty}
              </td>
            </tr>
          )}
          {rows.map((row, index) => (
            <tr key={`${row.label}-${index}`} className="border-b border-border-strong last:border-0">
              <td className="whitespace-nowrap px-3 py-2 text-text-primary">{row.label}</td>
              {row.values.map((value, i) => (
                <td key={i} className={`whitespace-nowrap px-3 py-2 tabular-nums text-text-primary ${alignRight ? "text-right" : ""}`}>
                  {typeof value === "number" ? num.format(value) : value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
