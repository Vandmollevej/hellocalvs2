import { IconCalendarStats, IconScale, IconTrendingDown, IconUser } from "@tabler/icons-react";
import { SectionHeading } from "@/components/landing/MarketingShell";
import {
  AGE_BAND_YEARS,
  MIN_USERS,
  PRODUCT_TYPE_DAYS,
  USAGE_DAYS,
  type AudienceComparisonRow,
  type AudienceProfile,
  type AudienceSex,
} from "@/lib/business-audience";

// "Den typiske bruger" på /business: nøgletal for medianbrugeren, de mest
// registrerede produkttyper og en sammenligning i procentpoint med
// gennemsnittet af brugere med samme køn og alder. Kun visning — tallene
// regnes i src/lib/business-audience.ts.

function number(value: number, digits = 0): string {
  return value.toLocaleString("da-DK", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function signed(value: number, digits: number): string {
  const rounded = Number(value.toFixed(digits));
  if (rounded === 0) return `±${number(0, digits)}`;
  return rounded > 0 ? `+${number(rounded, digits)}` : `−${number(Math.abs(rounded), digits)}`;
}

function sexLabel(sex: AudienceSex | null): string {
  return sex === "FEMALE" ? "Kvinde" : sex === "MALE" ? "Mand" : "Køn ikke oplyst";
}

function sexPlural(sex: AudienceSex | null): string {
  return sex === "FEMALE" ? "kvinder" : sex === "MALE" ? "mænd" : "brugere";
}

function valueText(row: AudienceComparisonRow, value: number): string {
  switch (row.unit) {
    case "percent":
      return `${row.key === "weightChangePercent" ? signed(value, 1) : number(value, 1)} %`;
    case "perWeek":
      return number(value, 1);
    case "kg":
      return `${number(value, 1)} kg`;
    case "years":
      return `${number(value)} år`;
  }
}

function diffText(row: AudienceComparisonRow): string {
  return row.diffKind === "points" ? `${signed(row.diff, 1)} pp` : `${signed(row.diff, 0)} %`;
}

function cohortLabel(cohort: NonNullable<AudienceProfile["cohort"]>): string {
  const who = sexPlural(cohort.sex);
  if (cohort.ageFrom === null || cohort.ageTo === null) return who;
  return `${who} på ${cohort.ageFrom}–${cohort.ageTo} år`;
}

function Kpi({ icon: Icon, label, value, sub }: { icon: typeof IconUser; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-hf-white px-5 py-6 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.35)]">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-hf-green text-hf-white">
        <Icon size={22} aria-hidden="true" />
      </span>
      <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-text-secondary">{label}</p>
      <p className="mt-1 text-3xl font-bold text-hf-green">{value}</p>
      {sub && <p className="mt-1 text-sm text-text-secondary">{sub}</p>}
    </div>
  );
}

export function BusinessAudience({ profile }: { profile: AudienceProfile | null }) {
  return (
    <section id="typisk-bruger" className="scroll-mt-20 bg-hf-cream px-4 py-20 sm:px-6">
      <SectionHeading
        title="Den typiske"
        accent="bruger"
        text="Medianbrugeren i Hello Cal — rigtige tal fra appen, altid som gennemsnit og aldrig om enkeltpersoner."
      />

      {!profile ? (
        <p className="mx-auto mt-10 max-w-2xl text-center text-text-secondary">
          Statistikken vises, når mindst {MIN_USERS} brugere har brugt appen.
        </p>
      ) : (
        <div className="mx-auto mt-12 max-w-6xl">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            <Kpi
              icon={IconUser}
              label="Hvem"
              value={profile.medianAge === null ? sexLabel(profile.sex) : `${sexLabel(profile.sex)}, ${profile.medianAge} år`}
              sub={
                profile.sexShare === null
                  ? `${number(profile.users)} brugere i alt`
                  : `${number(profile.sexShare * 100)} % af brugerne · ${number(profile.users)} brugere i alt`
              }
            />
            <Kpi
              icon={IconScale}
              label="Startvægt"
              value={profile.medianStartWeightKg === null ? "–" : `${number(profile.medianStartWeightKg, 1)} kg`}
              sub="Median ved første vejning"
            />
            <Kpi
              icon={IconTrendingDown}
              label="Vægtændring"
              value={profile.medianWeightChangeKg === null ? "–" : `${signed(profile.medianWeightChangeKg, 1)} kg`}
              sub={
                profile.lostWeightShare === null
                  ? "Kræver vejninger over mindst to uger"
                  : `${number(profile.lostWeightShare * 100)} % har tabt sig · ${number(profile.weightUsers)} med vejedata`
              }
            />
            <Kpi
              icon={IconCalendarStats}
              label="Brug pr. uge"
              value={`${number(profile.medianRegistrationsPerWeek, 1)} registreringer`}
              sub={`${number(profile.medianActiveDaysPerWeek, 1)} dage med registrering · seneste ${USAGE_DAYS} dage`}
            />
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-[2fr_3fr]">
            <div className="rounded-2xl bg-hf-white p-6 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.35)]">
              <h3 className="text-lg font-bold text-hf-black">Mest registrerede produkttyper</h3>
              <p className="mt-1 text-sm text-text-secondary">Andel af alle registreringer de seneste {PRODUCT_TYPE_DAYS} dage.</p>
              {profile.topProductTypes.length === 0 ? (
                <p className="mt-6 text-text-secondary">Ingen registreringer i perioden.</p>
              ) : (
                <ol className="mt-6 flex flex-col gap-4">
                  {profile.topProductTypes.map((type) => (
                    <li key={type.productType}>
                      <div className="flex items-baseline justify-between gap-4">
                        <span className="font-semibold text-hf-black">{type.productType}</span>
                        <span className="text-sm font-semibold text-hf-green">{number(type.share * 100, 1)} %</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-hf-tan-dark">
                        <div className="h-full rounded-full bg-hf-green" style={{ width: `${Math.max(2, type.share * 100)}%` }} />
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div className="rounded-2xl bg-hf-white p-6 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.35)]">
              <h3 className="text-lg font-bold text-hf-black">Sammenlignet med samme køn og alder</h3>
              {!profile.cohort ? (
                <p className="mt-6 text-text-secondary">Sammenligningen vises, når der er nok brugere med samme køn og alder.</p>
              ) : (
                <>
                  <p className="mt-1 text-sm text-text-secondary">
                    Den typiske bruger (median) mod gennemsnittet af {cohortLabel(profile.cohort)} ({number(profile.cohort.size)} brugere).
                    Forskel i procentpoint (pp) for andele, ellers i procent.
                  </p>
                  <table className="mt-6 w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
                        <th scope="col" className="pb-2 pr-2 font-semibold">Nøgletal</th>
                        <th scope="col" className="pb-2 pr-2 text-right font-semibold">Typisk</th>
                        <th scope="col" className="pb-2 pr-2 text-right font-semibold">Gennemsnit</th>
                        <th scope="col" className="pb-2 text-right font-semibold">Forskel</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profile.cohort.rows.map((row) => (
                        <tr key={row.key} className="border-t border-hf-tan-dark">
                          <th scope="row" className="py-2.5 pr-2 text-left font-medium text-hf-black">{row.label}</th>
                          <td className="py-2.5 pr-2 text-right tabular-nums text-hf-black">{valueText(row, row.typical)}</td>
                          <td className="py-2.5 pr-2 text-right tabular-nums text-text-secondary">{valueText(row, row.cohort)}</td>
                          <td className="py-2.5 text-right font-semibold tabular-nums text-hf-green">{diffText(row)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-text-muted">
            Medianer over aktive brugere uden børneprofiler. Samme alder = ±{AGE_BAND_YEARS} år omkring medianalderen. Vægtændring kræver
            vejninger med mindst to ugers mellemrum. Tallene opdateres løbende og kan ikke føres tilbage til enkelte brugere.
          </p>
        </div>
      )}
    </section>
  );
}
