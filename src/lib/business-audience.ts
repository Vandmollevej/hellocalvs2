// "Den typiske bruger" på /business (B2B/annoncør-siden): medianbrugeren med
// statistik over brug, vægttab og mest registrerede produkttyper, og hvordan
// den typiske bruger adskiller sig (i procentpoint) fra gennemsnittet af
// brugere med samme køn og alder. Se docs/DECISIONS.md 2026-10-02.
//
// Principper:
// - Altid rigtige tal fra databasen, aldrig opfundne (som forsidens nøgletal).
//   Under MIN_USERS brugere vises ingen tal, kun en kort forklaring.
// - Kun aggregater: ingen enkeltbruger kan udledes. Sammenligningsgruppen
//   kræver mindst MIN_COHORT brugere.
// - Børneprofiler tælles ikke med (de ser ingen reklamer).
// - Beregningen er ren (computeAudienceProfile) og testes i
//   business-audience.test.mjs; loadBusinessAudience henter kun rækkerne.

export const MIN_USERS = 10;
export const MIN_COHORT = 5;
/** Brug (registreringer, aktive dage) måles over de seneste 30 dage. */
export const USAGE_DAYS = 30;
/** Produkttyper tælles over de seneste 90 dage. */
export const PRODUCT_TYPE_DAYS = 90;
/** Vægtændring kræver to vejninger med mindst så mange dage imellem. */
export const MIN_WEIGHT_SPAN_DAYS = 14;
/** Alderssammenligningen bruger ± så mange år omkring medianalderen. */
export const AGE_BAND_YEARS = 5;
const TOP_PRODUCT_TYPES = 5;

export type AudienceSex = "FEMALE" | "MALE";

export type AudienceUser = {
  id: string;
  sex: AudienceSex | null;
  age: number | null;
  /** Første og seneste vejning (kg) + dage imellem. Null uden vejninger. */
  firstWeightKg: number | null;
  lastWeightKg: number | null;
  weightSpanDays: number;
  /** Registreringer og dage med mindst én registrering i USAGE_DAYS. */
  registrations: number;
  activeDays: number;
  /** Registreringer pr. produkttype i PRODUCT_TYPE_DAYS. */
  typeCounts: Record<string, number>;
};

export type AudienceMetricUnit = "years" | "kg" | "perWeek" | "percent";

/** Hvordan "Forskel"-kolonnen regnes: procentpoint for andele, ellers relativ %. */
export type AudienceDiffKind = "points" | "relative";

export type AudienceComparisonRow = {
  key: string;
  label: string;
  unit: AudienceMetricUnit;
  /** Den typiske brugers (median-)værdi. */
  typical: number;
  /** Gennemsnittet i sammenligningsgruppen (samme køn og alder). */
  cohort: number;
  /** typical − cohort: procentpoint for andele, ellers relativ forskel i %. */
  diff: number;
  diffKind: AudienceDiffKind;
};

export type AudienceProductType = {
  productType: string;
  /** Andel af alle registreringer i perioden (0-1). */
  share: number;
};

export type AudienceProfile = {
  users: number;
  sex: AudienceSex | null;
  /** Andel af brugerne med den typiske brugers køn (0-1). */
  sexShare: number | null;
  medianAge: number | null;
  medianStartWeightKg: number | null;
  /** Median vægtændring (kg) for brugere med vejninger over MIN_WEIGHT_SPAN_DAYS. Negativ = vægttab. */
  medianWeightChangeKg: number | null;
  /** Andel af brugere med vejedata, der har tabt sig (0-1). */
  lostWeightShare: number | null;
  weightUsers: number;
  medianRegistrationsPerWeek: number;
  medianActiveDaysPerWeek: number;
  topProductTypes: AudienceProductType[];
  cohort: {
    size: number;
    sex: AudienceSex | null;
    ageFrom: number | null;
    ageTo: number | null;
    rows: AudienceComparisonRow[];
  } | null;
};

export function median(values: number[]): number | null {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mean(values: number[]): number | null {
  const valid = values.filter((v) => Number.isFinite(v));
  if (valid.length === 0) return null;
  return valid.reduce((sum, v) => sum + v, 0) / valid.length;
}

function perWeek(count: number, days: number): number {
  return (count / days) * 7;
}

function weightChangeKg(user: AudienceUser): number | null {
  if (user.firstWeightKg === null || user.lastWeightKg === null) return null;
  if (user.weightSpanDays < MIN_WEIGHT_SPAN_DAYS) return null;
  return user.lastWeightKg - user.firstWeightKg;
}

/** Vægtændring i % af startvægten (negativ = tab). */
function weightChangePercent(user: AudienceUser): number | null {
  const change = weightChangeKg(user);
  if (change === null || !user.firstWeightKg) return null;
  return (change / user.firstWeightKg) * 100;
}

function typeShare(user: AudienceUser, productType: string): number | null {
  const total = Object.values(user.typeCounts).reduce((sum, n) => sum + n, 0);
  if (total === 0) return null;
  return ((user.typeCounts[productType] ?? 0) / total) * 100;
}

function mostCommonSex(users: AudienceUser[]): { sex: AudienceSex | null; share: number | null } {
  const counts = { FEMALE: 0, MALE: 0 };
  for (const user of users) if (user.sex) counts[user.sex] += 1;
  const known = counts.FEMALE + counts.MALE;
  if (known === 0) return { sex: null, share: null };
  const sex: AudienceSex = counts.FEMALE >= counts.MALE ? "FEMALE" : "MALE";
  return { sex, share: counts[sex] / known };
}

function topProductTypes(users: AudienceUser[]): AudienceProductType[] {
  const totals = new Map<string, number>();
  let all = 0;
  for (const user of users) {
    for (const [type, count] of Object.entries(user.typeCounts)) {
      totals.set(type, (totals.get(type) ?? 0) + count);
      all += count;
    }
  }
  if (all === 0) return [];
  return Array.from(totals.entries())
    .map(([productType, count]) => ({ productType, share: count / all }))
    .sort((a, b) => b.share - a.share)
    .slice(0, TOP_PRODUCT_TYPES);
}

type MetricDef = {
  key: string;
  label: string;
  unit: AudienceMetricUnit;
  diffKind: AudienceDiffKind;
  value: (user: AudienceUser) => number | null;
};

function comparisonMetrics(types: AudienceProductType[]): MetricDef[] {
  const base: MetricDef[] = [
    {
      key: "registrationsPerWeek",
      label: "Registreringer pr. uge",
      unit: "perWeek",
      diffKind: "relative",
      value: (u) => perWeek(u.registrations, USAGE_DAYS),
    },
    {
      key: "activeDaysShare",
      label: "Dage med registrering",
      unit: "percent",
      diffKind: "points",
      value: (u) => (u.activeDays / USAGE_DAYS) * 100,
    },
    {
      key: "weightChangePercent",
      label: "Vægtændring i % af startvægt",
      unit: "percent",
      diffKind: "points",
      value: weightChangePercent,
    },
    {
      key: "lostWeightShare",
      label: "Andel der har tabt sig",
      unit: "percent",
      diffKind: "points",
      value: (u) => {
        const change = weightChangeKg(u);
        return change === null ? null : change < 0 ? 100 : 0;
      },
    },
  ];
  const typeRows: MetricDef[] = types.map((t) => ({
    key: `type:${t.productType}`,
    label: `Andel ${t.productType.toLowerCase()}`,
    unit: "percent",
    diffKind: "points",
    value: (u) => typeShare(u, t.productType),
  }));
  return [...base, ...typeRows];
}

function values(users: AudienceUser[], metric: MetricDef): number[] {
  return users.map(metric.value).filter((v): v is number => v !== null);
}

function diff(typical: number, cohort: number, kind: AudienceDiffKind): number {
  if (kind === "points") return typical - cohort;
  if (cohort === 0) return 0;
  return ((typical - cohort) / Math.abs(cohort)) * 100;
}

/** Brugere med samme køn og alder (± AGE_BAND_YEARS) som den typiske bruger. */
export function cohortOf(users: AudienceUser[], sex: AudienceSex | null, medianAge: number | null): AudienceUser[] {
  return users.filter((user) => {
    if (sex && user.sex !== sex) return false;
    if (medianAge !== null) {
      if (user.age === null) return false;
      if (Math.abs(user.age - medianAge) > AGE_BAND_YEARS) return false;
    }
    return true;
  });
}

export function computeAudienceProfile(input: AudienceUser[]): AudienceProfile | null {
  // Kun brugere, der faktisk har brugt appen (ellers trækker tomme konti
  // medianen ned til nul uden at sige noget om målgruppen).
  const users = input.filter((user) => user.registrations > 0 || (user.firstWeightKg !== null && user.weightSpanDays > 0));
  if (users.length < MIN_USERS) return null;

  const { sex, share: sexShare } = mostCommonSex(users);
  const ages = users.map((u) => u.age).filter((a): a is number => a !== null);
  const medianAge = median(ages);
  const medianAgeRounded = medianAge === null ? null : Math.round(medianAge);
  const weightChanges = users.map(weightChangeKg).filter((v): v is number => v !== null);
  const types = topProductTypes(users);

  const cohortUsers = cohortOf(users, sex, medianAgeRounded);
  let cohort: AudienceProfile["cohort"] = null;
  if (cohortUsers.length >= MIN_COHORT) {
    const rows: AudienceComparisonRow[] = [];
    for (const metric of comparisonMetrics(types)) {
      const typical = median(values(users, metric));
      const cohortMean = mean(values(cohortUsers, metric));
      if (typical === null || cohortMean === null) continue;
      rows.push({
        key: metric.key,
        label: metric.label,
        unit: metric.unit,
        typical,
        cohort: cohortMean,
        diff: diff(typical, cohortMean, metric.diffKind),
        diffKind: metric.diffKind,
      });
    }
    cohort = {
      size: cohortUsers.length,
      sex,
      ageFrom: medianAgeRounded === null ? null : medianAgeRounded - AGE_BAND_YEARS,
      ageTo: medianAgeRounded === null ? null : medianAgeRounded + AGE_BAND_YEARS,
      rows,
    };
  }

  return {
    users: users.length,
    sex,
    sexShare,
    medianAge: medianAgeRounded,
    medianStartWeightKg: median(users.map((u) => u.firstWeightKg).filter((v): v is number => v !== null)),
    medianWeightChangeKg: median(weightChanges),
    lostWeightShare: weightChanges.length ? weightChanges.filter((v) => v < 0).length / weightChanges.length : null,
    weightUsers: weightChanges.length,
    medianRegistrationsPerWeek: median(users.map((u) => perWeek(u.registrations, USAGE_DAYS))) ?? 0,
    medianActiveDaysPerWeek: median(users.map((u) => perWeek(u.activeDays, USAGE_DAYS))) ?? 0,
    topProductTypes: types,
    cohort,
  };
}
