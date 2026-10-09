import type { TrainingIntensity } from "@/lib/pal-model";

// Kun type-import fra pal-model: node --test (uden alias-opløsning) skal
// kunne køre activity-met.test.mjs, og Node fjerner type-importer selv.
const INTENSITIES = ["LIGHT", "MODERATE", "VIGOROUS", "VERY_VIGOROUS"] as const satisfies readonly TrainingIntensity[];

/** Netto-kcal: (MET − 1) × kg × timer — samme formel som pal-model.netActivityKcal. */
function netKcal(met: number, weightKg: number, minutes: number) {
  if (!(met > 1) || !(weightKg > 0) || !(minutes > 0)) return 0;
  return (met - 1) * weightKg * (minutes / 60);
}

// MET for konkrete aktiviteter (docs/ACTIVITY-PAL.md §7, Compendium of
// Physical Activities, pacompendium.com). Brutto-MET pr. sportstype og
// intensitet fra taletesten; kalorier regnes altid netto (MET − 1), fordi
// hvilestofskiftet allerede ligger i BMR × PAL. Standard-MET er et estimat
// for en gennemsnitsperson — derfor vises resultatet som "ca.".

type MetByIntensity = Record<TrainingIntensity, number>;

/** Brutto-MET: let, moderat, høj, meget høj (taletesten). */
type MetRow = [number, number, number, number];

export type ActivityCatalogEntry = {
  /** Gemmes i Activity.sportType. Må aldrig omdøbes (gamle registreringer). */
  key: string;
  label: string;
  met: MetRow;
  /** Ekstra søgeord (synonymer, engelske navne, underformer). */
  words?: string[];
};

// Alle aktiviteter, man kan vælge under Tilføj → Aktivitet: alt der får
// pulsen op (docs/DECISIONS.md 2026-10-02). Ikoner står i
// src/lib/sport-icons.ts. De ti første nøgler fandtes før kataloget og
// bruges af integrationerne (normalizeSportType) og Statistik-kortene.
// Ukendte/brugertilføjede aktiviteter bruger "other".
export const ACTIVITY_CATALOG: ActivityCatalogEntry[] = [
  { key: "running", label: "Løb", met: [6.0, 8.3, 9.8, 11.5], words: ["jogging", "running", "motionsløb"] },
  { key: "cycling", label: "Cykling", met: [4.0, 6.8, 8.5, 10.5], words: ["cykel", "racercykel", "landevej", "bike"] },
  { key: "walking", label: "Gang", met: [2.8, 3.5, 4.3, 5.5], words: ["gåtur", "powerwalk", "barnevogn", "walking"] },
  { key: "swimming", label: "Svømning", met: [4.8, 6.0, 8.3, 10.0], words: ["svømmehal", "crawl", "brystsvømning"] },
  { key: "cardio", label: "Cardio", met: [4.0, 5.5, 7.5, 9.0], words: ["kondition", "fitness"] },
  { key: "ski", label: "Ski (alpint)", met: [4.3, 5.3, 7.0, 9.0], words: ["skiferie", "slalom", "alpin", "skiing"] },
  { key: "strength", label: "Styrketræning", met: [3.0, 3.5, 5.0, 6.0], words: ["vægte", "fitness", "maskiner", "gym"] },
  { key: "yoga", label: "Yoga", met: [2.3, 2.5, 3.3, 4.0], words: ["power yoga", "vinyasa", "ashtanga", "hot yoga"] },
  { key: "football", label: "Fodbold", met: [4.0, 7.0, 8.0, 10.0], words: ["soccer", "futsal", "football"] },
  { key: "other", label: "Anden aktivitet", met: [3.0, 4.5, 7.0, 9.0] },

  // Løb, gang og bjerge
  { key: "trail_running", label: "Trailløb", met: [7.0, 9.0, 10.5, 12.5], words: ["terrænløb", "skovløb"] },
  { key: "treadmill", label: "Løbebånd", met: [5.0, 8.0, 9.8, 11.5], words: ["treadmill"] },
  { key: "orienteering", label: "Orienteringsløb", met: [6.0, 8.0, 9.0, 10.0], words: ["o-løb"] },
  { key: "obstacle_race", label: "Forhindringsløb", met: [6.0, 8.0, 9.5, 11.0], words: ["mudrun", "ocr", "military race"] },
  { key: "nordic_walking", label: "Stavgang", met: [3.8, 4.8, 5.8, 6.8], words: ["nordic walking"] },
  { key: "hiking", label: "Vandring", met: [4.0, 5.3, 6.5, 7.8], words: ["vandretur", "trekking", "bjergvandring", "hike"] },
  { key: "dog_walking", label: "Gåtur med hund", met: [2.8, 3.5, 4.3, 5.0], words: ["hund", "luftning"] },
  { key: "stair_climbing", label: "Trappeløb", met: [4.0, 6.0, 8.8, 10.0], words: ["trapper", "stairmaster", "trappemaskine"] },
  { key: "climbing", label: "Klatring", met: [5.0, 5.8, 7.5, 9.0], words: ["bouldering", "klatrevæg", "climbing"] },

  // Cykel
  { key: "spinning", label: "Spinning", met: [5.5, 7.0, 8.8, 10.5], words: ["indendørs cykling", "motionscykel", "kondicykel", "indoor cycling"] },
  { key: "mountain_biking", label: "Mountainbike", met: [6.0, 8.5, 10.0, 12.0], words: ["mtb"] },
  { key: "ebike", label: "Elcykel", met: [3.0, 4.0, 5.0, 6.0], words: ["e-bike", "el-cykel"] },

  // Vand
  { key: "open_water", label: "Svømning i åbent vand", met: [5.0, 6.5, 8.5, 10.0], words: ["havsvømning", "åbent vand","open water", "vinterbadning"] },
  { key: "aqua_fitness", label: "Vandgymnastik", met: [3.0, 4.0, 5.5, 6.5], words: ["aqua fitness", "aquajogging", "vandaerobic"] },
  { key: "water_polo", label: "Vandpolo", met: [5.0, 7.0, 10.0, 12.0] },
  { key: "rowing", label: "Roning", met: [3.5, 5.8, 8.5, 12.0], words: ["robåd", "kaproning"] },
  { key: "rowing_machine", label: "Romaskine", met: [4.8, 7.0, 8.5, 12.0], words: ["ergometer", "concept2", "indoor rowing"] },
  { key: "kayaking", label: "Kajak", met: [3.5, 5.0, 7.0, 9.0], words: ["havkajak", "kajakroning"] },
  { key: "canoeing", label: "Kano", met: [3.0, 4.5, 6.0, 8.0] },
  { key: "sup", label: "Stand up paddle", met: [3.0, 4.5, 6.0, 7.0], words: ["sup", "paddleboard"] },
  { key: "surfing", label: "Surfing", met: [3.0, 4.0, 5.0, 6.5], words: ["bølgesurf", "bodyboard"] },
  { key: "windsurfing", label: "Wind- og kitesurfing", met: [3.0, 5.0, 7.0, 8.5], words: ["kitesurf", "wingfoil"] },

  // Hold, bold og ketsjer
  { key: "handball", label: "Håndbold", met: [6.0, 8.0, 10.0, 12.0] },
  { key: "basketball", label: "Basketball", met: [4.5, 6.5, 8.0, 9.3], words: ["basket", "streetbasket"] },
  { key: "volleyball", label: "Volleyball", met: [3.0, 4.0, 6.0, 8.0], words: ["beachvolley", "beach volley"] },
  { key: "floorball", label: "Floorball", met: [5.0, 7.0, 8.0, 10.0], words: ["hockey", "landhockey", "bandy"] },
  { key: "ice_hockey", label: "Ishockey", met: [6.0, 8.0, 10.0, 12.0], words: ["hockey"] },
  { key: "rugby", label: "Rugby", met: [6.3, 8.3, 10.0, 11.0] },
  { key: "ultimate", label: "Ultimate frisbee", met: [3.0, 5.0, 8.0, 9.0], words: ["frisbee", "disc", "discgolf"] },
  { key: "tennis", label: "Tennis", met: [4.5, 6.8, 8.0, 9.5] },
  { key: "padel", label: "Padel", met: [4.5, 6.0, 7.0, 8.0], words: ["padeltennis"] },
  { key: "badminton", label: "Badminton", met: [4.5, 5.5, 7.0, 8.5] },
  { key: "squash", label: "Squash", met: [6.0, 7.3, 9.0, 12.0] },
  { key: "table_tennis", label: "Bordtennis", met: [3.0, 4.0, 5.5, 6.5], words: ["ping pong"] },
  { key: "golf", label: "Golf", met: [3.5, 4.8, 5.5, 6.0], words: ["golfbane", "18 huller"] },

  // Hold-træning og intervaller
  { key: "hiit", label: "HIIT / intervaltræning", met: [6.0, 8.0, 9.5, 11.0], words: ["interval", "tabata", "intervaller"] },
  { key: "circuit", label: "Cirkeltræning", met: [4.3, 6.0, 8.0, 9.5], words: ["circuit", "stationstræning"] },
  { key: "crossfit", label: "CrossFit", met: [5.0, 6.5, 8.0, 10.0], words: ["funktionel træning", "functional", "wod"] },
  { key: "bootcamp", label: "Bootcamp", met: [5.0, 6.5, 8.0, 9.5], words: ["udendørs træning"] },
  { key: "kettlebell", label: "Kettlebell", met: [4.5, 6.5, 8.0, 9.8] },
  { key: "bodyweight", label: "Kropsvægtstræning", met: [3.0, 3.8, 6.0, 8.0], words: ["calisthenics", "armbøjninger", "burpees", "mavebøjninger"] },
  { key: "elliptical", label: "Crosstrainer", met: [4.5, 5.5, 7.0, 8.5], words: ["elliptical"] },
  { key: "jump_rope", label: "Sjippetov", met: [8.0, 10.0, 11.5, 12.3], words: ["sjippe", "jump rope"] },
  { key: "trampoline", label: "Trampolin", met: [3.5, 4.5, 6.0, 7.5] },
  { key: "aerobics", label: "Aerobic", met: [5.0, 6.5, 7.5, 9.0], words: ["step", "body pump", "holdtræning"] },
  { key: "pilates", label: "Pilates", met: [2.8, 3.0, 4.0, 5.0], words: ["reformer"] },

  // Dans
  { key: "dance", label: "Dans", met: [3.5, 5.0, 7.0, 8.5], words: ["salsa", "hiphop", "swing", "lindy hop", "folkedans", "linedance", "danse"] },
  { key: "zumba", label: "Zumba", met: [4.0, 5.5, 7.0, 8.0], words: ["dansefitness"] },
  { key: "ballet", label: "Ballet", met: [4.0, 5.0, 6.8, 8.0], words: ["jazzballet", "moderne dans"] },

  // Kamp
  { key: "boxing", label: "Boksning", met: [5.5, 7.8, 9.5, 12.0], words: ["boksesæk", "sparring", "boxercise"] },
  { key: "kickboxing", label: "Kickboksning", met: [5.5, 7.5, 9.5, 11.0], words: ["thaiboksning", "muay thai", "mma"] },
  { key: "martial_arts", label: "Kampsport", met: [4.0, 5.3, 7.0, 10.3], words: ["karate", "judo", "taekwondo", "jiu-jitsu", "aikido", "kung fu"] },
  { key: "wrestling", label: "Brydning", met: [4.0, 6.0, 8.0, 9.0] },
  { key: "fencing", label: "Fægtning", met: [4.0, 6.0, 8.0, 10.0] },

  // Is og sne
  { key: "cross_country_ski", label: "Langrend", met: [6.0, 9.0, 12.5, 15.0], words: ["langrendsski", "rulleski"] },
  { key: "snowboard", label: "Snowboard", met: [4.3, 5.3, 7.0, 8.0] },
  { key: "ice_skating", label: "Skøjteløb", met: [4.0, 5.5, 7.0, 9.0], words: ["skøjter", "kunstskøjteløb"] },
  { key: "snow_shoveling", label: "Snerydning", met: [4.0, 5.3, 6.5, 7.5], words: ["skovle sne", "sneskovl"] },

  // Hjul og bræt
  { key: "inline_skating", label: "Rulleskøjter", met: [5.5, 7.5, 9.8, 12.0], words: ["inliners", "rollerblades"] },
  { key: "skateboarding", label: "Skateboard", met: [4.0, 5.0, 6.0, 7.0], words: ["longboard", "løbehjul"] },

  // Hverdag med puls
  { key: "horse_riding", label: "Ridning", met: [3.5, 5.5, 7.0, 8.0], words: ["hest", "dressur", "springridning", "staldarbejde"] },
  { key: "gardening", label: "Havearbejde", met: [2.5, 3.5, 5.0, 6.0], words: ["græsslåning", "gravning", "lugning", "have"] },
  { key: "woodcutting", label: "Brændehugning", met: [4.5, 6.0, 7.5, 9.0], words: ["brænde", "fældning", "skovarbejde"] },
  { key: "moving", label: "Flytning / bære tungt", met: [4.0, 5.8, 7.0, 8.0], words: ["flytte", "bære", "løfte"] },
  { key: "housework", label: "Rengøring / husarbejde", met: [2.5, 3.3, 3.8, 4.5], words: ["støvsugning", "gulvvask", "oprydning"] },
  { key: "playing_kids", label: "Leg med børn", met: [2.5, 4.0, 5.8, 7.0], words: ["fangeleg", "legeplads", "børn"] },
];

// Nøgler = ACTIVITY_CATALOG. Ukendte/brugertilføjede aktiviteter bruger "other".
const MET_TABLE: Record<string, MetByIntensity> = Object.fromEntries(
  ACTIVITY_CATALOG.map((entry) => [
    entry.key,
    { LIGHT: entry.met[0], MODERATE: entry.met[1], VIGOROUS: entry.met[2], VERY_VIGOROUS: entry.met[3] },
  ]),
);

export const DEFAULT_INTENSITY: TrainingIntensity = "MODERATE";

export function isTrainingIntensity(value: unknown): value is TrainingIntensity {
  return typeof value === "string" && (INTENSITIES as readonly string[]).includes(value);
}

/** Brutto-MET for sport + intensitet (tabellen ovenfor). */
export function metFor(sportType: string, intensity: TrainingIntensity = DEFAULT_INTENSITY): number {
  const row = MET_TABLE[sportType] ?? MET_TABLE.other;
  return row[intensity];
}

// Gang og løb efter hastighed (km/t), når distance + tid kendes — bedre end
// intensitet alene (docs/ACTIVITY-PAL.md §11). Interpoleret fra Compendium.
const WALK_RUN_BY_SPEED: [number, number][] = [
  [3.2, 2.8],
  [4.0, 3.0],
  [4.8, 3.5],
  [5.6, 4.3],
  [6.4, 5.0],
  [7.2, 6.0],
  [8.0, 8.3],
  [9.7, 9.8],
  [11.3, 11.0],
  [12.9, 11.8],
  [14.5, 12.8],
  [16.1, 14.5],
];

export function metForSpeed(speedKmh: number): number {
  if (!(speedKmh > 0)) return WALK_RUN_BY_SPEED[0][1];
  let previous = WALK_RUN_BY_SPEED[0];
  for (const point of WALK_RUN_BY_SPEED) {
    if (speedKmh <= point[0]) {
      if (point === previous) return point[1];
      const share = (speedKmh - previous[0]) / (point[0] - previous[0]);
      return previous[1] + share * (point[1] - previous[1]);
    }
    previous = point;
  }
  return WALK_RUN_BY_SPEED[WALK_RUN_BY_SPEED.length - 1][1];
}

export type ActivityEstimateInput = {
  sportType: string;
  minutes: number;
  weightKg: number | null;
  intensity?: TrainingIntensity | null;
  distanceKm?: number | null;
};

export type ActivityEstimate = {
  met: number;
  /** Netto-kcal afrundet til nærmeste 5. Null uden vægt. */
  kcal: number | null;
  method: "SPEED" | "INTENSITY";
};

/** Anslåede netto-kcal for en logget aktivitet. */
export function estimateActivityKcal(input: ActivityEstimateInput): ActivityEstimate {
  const usesSpeed = (input.sportType === "walking" || input.sportType === "running") && !!input.distanceKm && input.distanceKm > 0 && input.minutes > 0;
  const met = usesSpeed ? metForSpeed((input.distanceKm! / input.minutes) * 60) : metFor(input.sportType, input.intensity ?? DEFAULT_INTENSITY);
  const kcal = input.weightKg ? Math.round(netKcal(met, input.weightKg, input.minutes) / 5) * 5 : null;
  return { met: Math.round(met * 10) / 10, kcal, method: usesSpeed ? "SPEED" : "INTENSITY" };
}
