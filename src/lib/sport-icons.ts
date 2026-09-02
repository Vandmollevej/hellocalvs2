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
  { key: "strength", label: "Styrketræning", icon: IconBarbell },
  { key: "yoga", label: "Yoga", icon: IconYoga },
  { key: "football", label: "Fodbold", icon: IconBallFootball },
  { key: "other", label: "Anden aktivitet", icon: IconActivity },
];

const SPORT_TYPE_MAP = new Map(SPORT_TYPES.map((sport) => [sport.key, sport]));

export function getSportMeta(sportType: string) {
  return SPORT_TYPE_MAP.get(sportType) ?? { key: sportType, label: sportType, icon: IconActivity };
}
