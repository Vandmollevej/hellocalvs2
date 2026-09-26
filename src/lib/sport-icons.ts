import {
  IconRun,
  IconBike,
  IconSwimming,
  IconBarbell,
  IconWalk,
  IconBallFootball,
  IconYoga,
  IconActivity,
  type Icon,
} from "@tabler/icons-react";

// Shared sport-type catalog. `key` is stored on Activity.sportType (free text,
// but we normalize to these keys where we can, see
// src/app/api/integrations/fitbit/sync). Used by the calendar's sport icon
// (Checkpoint 3) and Statistics' sport blocks (Checkpoint 4).
export const SPORT_TYPES: { key: string; label: string; icon: Icon }[] = [
  { key: "running", label: "Løb", icon: IconRun },
  { key: "cycling", label: "Cykling", icon: IconBike },
  { key: "walking", label: "Gang", icon: IconWalk },
  { key: "swimming", label: "Svømning", icon: IconSwimming },
  { key: "cardio", label: "Cardio", icon: IconActivity },
  { key: "ski", label: "Ski", icon: IconActivity },
  { key: "strength", label: "Styrketræning", icon: IconBarbell },
  { key: "yoga", label: "Yoga", icon: IconYoga },
  { key: "football", label: "Fodbold", icon: IconBallFootball },
  { key: "other", label: "Anden aktivitet", icon: IconActivity },
];

const SPORT_TYPE_MAP = new Map(SPORT_TYPES.map((sport) => [sport.key, sport]));

export function getSportMeta(sportType: string) {
  return SPORT_TYPE_MAP.get(sportType) ?? { key: sportType, label: sportType, icon: IconActivity };
}

// Integrationer navngiver samme sport forskelligt (Strava "Ride"/"VirtualRide",
// Google Health "BIKING", Polar "CYCLING", Fitbit "Outdoor Bike" …). Alt
// normaliseres til nøglerne ovenfor, så de lander i samme Statistik-kort.
// Ukendte typer beholdes (små bogstaver) og får deres eget kort.
const SPORT_ALIASES: [RegExp, string][] = [
  [/run|jog|treadmill|løb/, "running"],
  [/bik|cycl|ride|spinning|cykel|cykling/, "cycling"],
  [/swim|svøm/, "swimming"],
  [/ski|snowboard|langrend/, "ski"],
  [/walk|hike|hiking|gang|vandr/, "walking"],
  [/weight|strength|crossfit|functional|styrke|barbell/, "strength"],
  [/yoga|pilates/, "yoga"],
  [/soccer|football|fodbold/, "football"],
  [/cardio|elliptical|rowing|row|hiit|aerobic|stair|crosstrainer|romaskine/, "cardio"],
];

export function normalizeSportType(raw: string): string {
  const value = raw.trim().toLowerCase();
  if (!value) return "other";
  if (SPORT_TYPE_MAP.has(value)) return value;
  const compact = value.replace(/[\s_-]+/g, "");
  for (const [pattern, key] of SPORT_ALIASES) {
    if (pattern.test(compact) || pattern.test(value)) return key;
  }
  return value;
}
