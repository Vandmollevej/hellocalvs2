// Admin → Brugere → Personas (docs/DECISIONS.md 2026-10-02): rene
// beregninger på anonyme brugertræk. Ingen database her — src/lib/personas.ts
// samler trækkene, dette modul grupperer dem pr. dimension (land, by, sprog,
// alder, køn, abonnement, enhed) og i adfærdssegmenter, og bygger det
// aggregat, AI-modellen får. Testes i persona-groups.test.mjs.

export type AgeBucket = "under18" | "18-24" | "25-34" | "35-44" | "45-54" | "55-64" | "65+" | "unknown";
export type PersonaTier = "free" | "serious" | "family";
export type PersonaSex = "FEMALE" | "MALE" | "UNKNOWN";
export type UsagePattern = "morning" | "midday" | "evening" | "night" | "mixed" | "none";
export type BehaviourSegment = "new" | "power" | "regular" | "occasional" | "lurker" | "dormant";

// Ét anonymt sæt træk pr. bruger. Ingen id'er, navne eller e-mails.
export type PersonaUserFeatures = {
  country: string;
  city: string | null;
  language: string;
  ageBucket: AgeBucket;
  sex: PersonaSex;
  tier: PersonaTier;
  accountAgeDays: number;
  logins90d: number;
  loginDays90d: number;
  lastLoginDaysAgo: number | null;
  registrations30d: number;
  activeDays30d: number;
  hellofreshRegistrations30d: number;
  activities30d: number;
  weighIns30d: number;
  integrations: string[];
  loginHours: number[]; // 24 tællere (dansk tid)
  loginWeekdays: number[]; // 7 tællere, 0 = mandag
  deviceOs: string | null;
  onboardingCompleted: boolean;
  pushEnabled: boolean;
  goalMode: string | null;
  activityLevel: string | null;
};

export type PersonaDimension = "country" | "city" | "language" | "age" | "sex" | "tier" | "device";

export const PERSONA_DIMENSIONS: { key: PersonaDimension; label: string }[] = [
  { key: "country", label: "Land" },
  { key: "city", label: "By" },
  { key: "language", label: "Sprog" },
  { key: "age", label: "Alder" },
  { key: "sex", label: "Køn" },
  { key: "tier", label: "Abonnement" },
  { key: "device", label: "Enhed" },
];

// Grupper under denne størrelse slås sammen i "Øvrige", så ingen enkeltperson
// kan genkendes i tabellerne eller i det, AI-modellen får (k-anonymitet).
export const MIN_GROUP_SIZE = 5;
export const OTHER_GROUP_KEY = "__other";

export type PersonaGroup = {
  key: string;
  label: string;
  users: number;
  share: number;
  avgLogins90d: number;
  avgLoginDays90d: number;
  activeShare30d: number;
  avgRegistrations30d: number;
  avgActiveDays30d: number;
  payingShare: number;
  integrationShare: number;
  hellofreshShare: number;
  weighInShare: number;
  activityShare: number;
  pushShare: number;
  onboardingShare: number;
  dormantShare: number;
  weekendShare: number;
  peakHour: number | null;
  peakWeekday: number | null;
  usagePattern: UsagePattern;
  topLanguage: string | null;
  topAgeBucket: AgeBucket | null;
  femaleShare: number;
};

export type PersonaSegmentSummary = PersonaGroup & {
  segment: BehaviourSegment;
  topCountry: string | null;
  topTier: PersonaTier | null;
  topDevice: string | null;
};

export type PersonaAggregates = {
  computedAt: string;
  userCount: number;
  minGroupSize: number;
  totals: {
    activeUsers30d: number;
    payingUsers: number;
    countries: number;
    cities: number;
    languages: number;
    withIntegration: number;
    dormantUsers: number;
    usersWithLogins90d: number;
  };
  dimensions: Record<PersonaDimension, PersonaGroup[]>;
  segments: PersonaSegmentSummary[];
  crossTabs: {
    tierByAge: { age: AgeBucket; free: number; serious: number; family: number }[];
    languageByCountry: { country: string; languages: Record<string, number> }[];
    loginsByHour: number[];
    loginsByWeekday: number[];
  };
};

export const AGE_BUCKET_LABEL: Record<AgeBucket, string> = {
  under18: "Under 18",
  "18-24": "18–24 år",
  "25-34": "25–34 år",
  "35-44": "35–44 år",
  "45-54": "45–54 år",
  "55-64": "55–64 år",
  "65+": "65+ år",
  unknown: "Alder ukendt",
};

export const SEX_LABEL: Record<PersonaSex, string> = { FEMALE: "Kvinder", MALE: "Mænd", UNKNOWN: "Køn ukendt" };
export const TIER_LABEL: Record<PersonaTier, string> = { free: "Gratis", serious: "Seriøs", family: "Seriøs Familie" };

export const SEGMENT_LABEL: Record<BehaviourSegment, string> = {
  new: "Nye (under 14 dage)",
  power: "Storbrugere (20+ dage/md.)",
  regular: "Faste brugere (8–19 dage/md.)",
  occasional: "Lejlighedsvise (1–7 dage/md.)",
  lurker: "Kigger uden at logge mad",
  dormant: "Inaktive (30+ dage)",
};

export const SEGMENT_ORDER: BehaviourSegment[] = ["power", "regular", "occasional", "lurker", "new", "dormant"];

export const USAGE_PATTERN_LABEL: Record<UsagePattern, string> = {
  morning: "Morgen (05–10)",
  midday: "Dag (10–16)",
  evening: "Aften (16–22)",
  night: "Nat (22–05)",
  mixed: "Blandet",
  none: "Ingen logins",
};

const WEEKDAY_LABEL = ["man", "tirs", "ons", "tors", "fre", "lør", "søn"];

export function weekdayLabel(index: number | null): string {
  return index === null ? "—" : (WEEKDAY_LABEL[index] ?? "—");
}

export function ageBucketFor(age: number | null): AgeBucket {
  if (age === null || !Number.isFinite(age)) return "unknown";
  if (age < 18) return "under18";
  if (age < 25) return "18-24";
  if (age < 35) return "25-34";
  if (age < 45) return "35-44";
  if (age < 55) return "45-54";
  if (age < 65) return "55-64";
  return "65+";
}

// Samme opdeling som i persona-grupperne: morgen/dag/aften/nat ud fra
// hvilken del af døgnet, der rummer mindst halvdelen af de loggede logins.
export function usagePatternFor(loginHours: number[]): UsagePattern {
  const total = loginHours.reduce((sum, n) => sum + n, 0);
  if (total === 0) return "none";
  const sum = (from: number, to: number) => {
    let n = 0;
    for (let h = from; h !== to; h = (h + 1) % 24) n += loginHours[h] ?? 0;
    return n;
  };
  const parts: [UsagePattern, number][] = [
    ["morning", sum(5, 10)],
    ["midday", sum(10, 16)],
    ["evening", sum(16, 22)],
    ["night", sum(22, 5)],
  ];
  parts.sort((a, b) => b[1] - a[1]);
  return parts[0][1] / total >= 0.5 ? parts[0][0] : "mixed";
}

export function behaviourSegmentFor(f: PersonaUserFeatures): BehaviourSegment {
  if (f.accountAgeDays < 14) return "new";
  if (f.lastLoginDaysAgo === null || f.lastLoginDaysAgo > 30) {
    // Uden login-historik (før 2026-09-27) tæller registreringer som aktivitet.
    if (f.registrations30d === 0) return "dormant";
  }
  if (f.activeDays30d >= 20) return "power";
  if (f.activeDays30d >= 8) return "regular";
  if (f.activeDays30d >= 1) return "occasional";
  return "lurker";
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function mean(values: number[]): number {
  return values.length ? round(values.reduce((s, v) => s + v, 0) / values.length) : 0;
}

function share(count: number, total: number): number {
  return total ? round(count / total, 3) : 0;
}

function topKey<T extends string>(counts: Map<T, number>): T | null {
  let best: T | null = null;
  let bestCount = 0;
  for (const [key, count] of counts) {
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  }
  return best;
}

function countBy<T extends string>(items: T[]): Map<T, number> {
  const map = new Map<T, number>();
  for (const item of items) map.set(item, (map.get(item) ?? 0) + 1);
  return map;
}

function sumVectors(vectors: number[][], length: number): number[] {
  const out = new Array<number>(length).fill(0);
  for (const vector of vectors) for (let i = 0; i < length; i++) out[i] += vector[i] ?? 0;
  return out;
}

function peakIndex(vector: number[]): number | null {
  let best: number | null = null;
  let bestValue = 0;
  vector.forEach((value, index) => {
    if (value > bestValue) {
      best = index;
      bestValue = value;
    }
  });
  return best;
}

export function summarizeGroup(key: string, label: string, members: PersonaUserFeatures[], total: number): PersonaGroup {
  const n = members.length;
  const hours = sumVectors(
    members.map((m) => m.loginHours),
    24,
  );
  const weekdays = sumVectors(
    members.map((m) => m.loginWeekdays),
    7,
  );
  const weekdayTotal = weekdays.reduce((s, v) => s + v, 0);
  const languages = countBy(members.map((m) => m.language));
  const ages = countBy(members.map((m) => m.ageBucket).filter((b) => b !== "unknown"));
  return {
    key,
    label,
    users: n,
    share: share(n, total),
    avgLogins90d: mean(members.map((m) => m.logins90d)),
    avgLoginDays90d: mean(members.map((m) => m.loginDays90d)),
    activeShare30d: share(members.filter((m) => m.registrations30d > 0).length, n),
    avgRegistrations30d: mean(members.map((m) => m.registrations30d)),
    avgActiveDays30d: mean(members.map((m) => m.activeDays30d)),
    payingShare: share(members.filter((m) => m.tier !== "free").length, n),
    integrationShare: share(members.filter((m) => m.integrations.length > 0).length, n),
    hellofreshShare: share(members.filter((m) => m.hellofreshRegistrations30d > 0).length, n),
    weighInShare: share(members.filter((m) => m.weighIns30d > 0).length, n),
    activityShare: share(members.filter((m) => m.activities30d > 0).length, n),
    pushShare: share(members.filter((m) => m.pushEnabled).length, n),
    onboardingShare: share(members.filter((m) => m.onboardingCompleted).length, n),
    dormantShare: share(members.filter((m) => behaviourSegmentFor(m) === "dormant").length, n),
    weekendShare: weekdayTotal ? round(((weekdays[5] ?? 0) + (weekdays[6] ?? 0)) / weekdayTotal, 3) : 0,
    peakHour: peakIndex(hours),
    peakWeekday: peakIndex(weekdays),
    usagePattern: usagePatternFor(hours),
    topLanguage: topKey(languages),
    topAgeBucket: topKey(ages),
    femaleShare: share(members.filter((m) => m.sex === "FEMALE").length, n),
  };
}

function dimensionKey(f: PersonaUserFeatures, dimension: PersonaDimension): { key: string; label: string } {
  switch (dimension) {
    case "country":
      return { key: f.country, label: countryName(f.country) };
    case "city":
      return f.city ? { key: `${f.country}:${f.city}`, label: `${f.city}, ${f.country}` } : { key: "unknown", label: "By ukendt" };
    case "language":
      return { key: f.language, label: languageName(f.language) };
    case "age":
      return { key: f.ageBucket, label: AGE_BUCKET_LABEL[f.ageBucket] };
    case "sex":
      return { key: f.sex, label: SEX_LABEL[f.sex] };
    case "tier":
      return { key: f.tier, label: TIER_LABEL[f.tier] };
    case "device":
      return f.deviceOs ? { key: f.deviceOs, label: f.deviceOs } : { key: "unknown", label: "Enhed ukendt" };
  }
}

export function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(["da"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function languageName(code: string): string {
  if (code === "da") return "Dansk";
  if (code === "en") return "Engelsk";
  try {
    return new Intl.DisplayNames(["da"], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}

// Grupperer brugerne pr. dimension; grupper under MIN_GROUP_SIZE samles i
// "Øvrige". Sorteret efter størrelse, "Øvrige" og "ukendt" sidst.
export function groupByDimension(
  users: PersonaUserFeatures[],
  dimension: PersonaDimension,
  minGroupSize = MIN_GROUP_SIZE,
): PersonaGroup[] {
  const buckets = new Map<string, { label: string; members: PersonaUserFeatures[] }>();
  for (const user of users) {
    const { key, label } = dimensionKey(user, dimension);
    const bucket = buckets.get(key) ?? { label, members: [] };
    bucket.members.push(user);
    buckets.set(key, bucket);
  }
  const groups: PersonaGroup[] = [];
  const other: PersonaUserFeatures[] = [];
  let otherSources = 0;
  for (const [key, bucket] of buckets) {
    if (bucket.members.length < minGroupSize && key !== "unknown") {
      other.push(...bucket.members);
      otherSources += 1;
      continue;
    }
    groups.push(summarizeGroup(key, bucket.label, bucket.members, users.length));
  }
  groups.sort((a, b) => (a.key === "unknown" ? 1 : b.key === "unknown" ? -1 : b.users - a.users));
  if (other.length > 0) {
    groups.push(
      summarizeGroup(
        OTHER_GROUP_KEY,
        `Øvrige (${otherSources} grupper under ${minGroupSize})`,
        other,
        users.length,
      ),
    );
  }
  return groups;
}

export function summarizeSegments(users: PersonaUserFeatures[]): PersonaSegmentSummary[] {
  const bySegment = new Map<BehaviourSegment, PersonaUserFeatures[]>();
  for (const user of users) {
    const segment = behaviourSegmentFor(user);
    bySegment.set(segment, [...(bySegment.get(segment) ?? []), user]);
  }
  return SEGMENT_ORDER.filter((segment) => bySegment.has(segment)).map((segment) => {
    const members = bySegment.get(segment)!;
    const base = summarizeGroup(segment, SEGMENT_LABEL[segment], members, users.length);
    return {
      ...base,
      segment,
      topCountry: topKey(countBy(members.map((m) => m.country))),
      topTier: topKey(countBy(members.map((m) => m.tier))),
      topDevice: topKey(countBy(members.map((m) => m.deviceOs).filter((d): d is string => d !== null))),
    };
  });
}

export function buildPersonaAggregates(users: PersonaUserFeatures[], now: Date = new Date()): PersonaAggregates {
  const dimensions = Object.fromEntries(
    PERSONA_DIMENSIONS.map(({ key }) => [key, groupByDimension(users, key)]),
  ) as Record<PersonaDimension, PersonaGroup[]>;

  const ageOrder: AgeBucket[] = ["under18", "18-24", "25-34", "35-44", "45-54", "55-64", "65+", "unknown"];
  const tierByAge = ageOrder
    .map((age) => {
      const members = users.filter((u) => u.ageBucket === age);
      return {
        age,
        free: members.filter((u) => u.tier === "free").length,
        serious: members.filter((u) => u.tier === "serious").length,
        family: members.filter((u) => u.tier === "family").length,
      };
    })
    .filter((row) => row.free + row.serious + row.family >= MIN_GROUP_SIZE);

  const byCountry = new Map<string, PersonaUserFeatures[]>();
  for (const user of users) byCountry.set(user.country, [...(byCountry.get(user.country) ?? []), user]);
  const languageByCountry = [...byCountry]
    .filter(([, members]) => members.length >= MIN_GROUP_SIZE)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([country, members]) => ({
      country,
      languages: Object.fromEntries(countBy(members.map((m) => m.language))),
    }));

  return {
    computedAt: now.toISOString(),
    userCount: users.length,
    minGroupSize: MIN_GROUP_SIZE,
    totals: {
      activeUsers30d: users.filter((u) => u.registrations30d > 0).length,
      payingUsers: users.filter((u) => u.tier !== "free").length,
      countries: new Set(users.map((u) => u.country)).size,
      cities: new Set(users.map((u) => u.city).filter(Boolean)).size,
      languages: new Set(users.map((u) => u.language)).size,
      withIntegration: users.filter((u) => u.integrations.length > 0).length,
      dormantUsers: users.filter((u) => behaviourSegmentFor(u) === "dormant").length,
      usersWithLogins90d: users.filter((u) => u.logins90d > 0).length,
    },
    dimensions,
    segments: summarizeSegments(users),
    crossTabs: {
      tierByAge,
      languageByCountry,
      loginsByHour: sumVectors(
        users.map((u) => u.loginHours),
        24,
      ),
      loginsByWeekday: sumVectors(
        users.map((u) => u.loginWeekdays),
        7,
      ),
    },
  };
}

// Det, AI-modellen får: kun gruppetal og andele — aldrig enkeltbrugere.
export function aggregatesForAi(aggregates: PersonaAggregates) {
  const pct = (value: number) => Math.round(value * 100);
  const describe = (g: PersonaGroup) => ({
    gruppe: g.label,
    brugere: g.users,
    andel_pct: pct(g.share),
    logins_pr_bruger_90d: g.avgLogins90d,
    login_dage_pr_bruger_90d: g.avgLoginDays90d,
    aktive_pct_30d: pct(g.activeShare30d),
    registreringer_pr_bruger_30d: g.avgRegistrations30d,
    aktive_dage_pr_bruger_30d: g.avgActiveDays30d,
    betalende_pct: pct(g.payingShare),
    smartur_eller_sundhedsapp_pct: pct(g.integrationShare),
    hellofresh_pct: pct(g.hellofreshShare),
    vejer_sig_pct: pct(g.weighInShare),
    logger_motion_pct: pct(g.activityShare),
    push_til_pct: pct(g.pushShare),
    startguide_gennemfoert_pct: pct(g.onboardingShare),
    inaktive_pct: pct(g.dormantShare),
    weekend_logins_pct: pct(g.weekendShare),
    typisk_tidspunkt: USAGE_PATTERN_LABEL[g.usagePattern],
    top_time: g.peakHour,
    top_ugedag: weekdayLabel(g.peakWeekday),
    hyppigste_sprog: g.topLanguage ? languageName(g.topLanguage) : null,
    hyppigste_aldersgruppe: g.topAgeBucket ? AGE_BUCKET_LABEL[g.topAgeBucket] : null,
    kvinder_pct: pct(g.femaleShare),
  });
  return {
    beregnet: aggregates.computedAt,
    brugere_i_alt: aggregates.userCount,
    mindste_gruppe: aggregates.minGroupSize,
    totaler: aggregates.totals,
    grupper: Object.fromEntries(
      PERSONA_DIMENSIONS.map(({ key, label }) => [label, aggregates.dimensions[key].map(describe)]),
    ),
    adfaerdssegmenter: aggregates.segments.map((s) => ({
      ...describe(s),
      hyppigste_land: s.topCountry ? countryName(s.topCountry) : null,
      hyppigste_abonnement: s.topTier ? TIER_LABEL[s.topTier] : null,
      hyppigste_enhed: s.topDevice,
    })),
    abonnement_pr_aldersgruppe: aggregates.crossTabs.tierByAge.map((row) => ({
      alder: AGE_BUCKET_LABEL[row.age],
      gratis: row.free,
      serioes: row.serious,
      familie: row.family,
    })),
    sprog_pr_land: aggregates.crossTabs.languageByCountry.map((row) => ({
      land: countryName(row.country),
      ...Object.fromEntries(Object.entries(row.languages).map(([code, n]) => [languageName(code), n])),
    })),
    logins_pr_time: aggregates.crossTabs.loginsByHour,
    logins_pr_ugedag: WEEKDAY_LABEL.map((label, i) => ({ dag: label, logins: aggregates.crossTabs.loginsByWeekday[i] ?? 0 })),
  };
}
