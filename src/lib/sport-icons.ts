import {
  IconActivity,
  IconAxe,
  IconBallBasketball,
  IconBallFootball,
  IconBallTennis,
  IconBallVolleyball,
  IconBarbell,
  IconBike,
  IconBox,
  IconDisc,
  IconDog,
  IconGolf,
  IconGymnastics,
  IconHeartbeat,
  IconHome,
  IconHorse,
  IconIceSkating,
  IconJumpRope,
  IconKarate,
  IconKayak,
  IconMoodKid,
  IconMountain,
  IconMusic,
  IconPingPong,
  IconPlant,
  IconPlayHandball,
  IconPool,
  IconRun,
  IconSailboat,
  IconShovel,
  IconSkateboarding,
  IconSnowboarding,
  IconSnowflake,
  IconStairsUp,
  IconStretching,
  IconSwimming,
  IconSwords,
  IconTreadmill,
  IconTrekking,
  IconWalk,
  IconWaveSine,
  IconYoga,
  type Icon,
} from "@tabler/icons-react";
import { ACTIVITY_CATALOG } from "@/lib/activity-met";

// Ikon pr. aktivitet i kataloget (src/lib/activity-met.ts). Tabler har ikke
// et ikon til alt; manglende falder tilbage til IconActivity.
const SPORT_ICONS: Record<string, Icon> = {
  running: IconRun,
  trail_running: IconRun,
  orienteering: IconRun,
  obstacle_race: IconRun,
  treadmill: IconTreadmill,
  cycling: IconBike,
  spinning: IconBike,
  mountain_biking: IconBike,
  ebike: IconBike,
  walking: IconWalk,
  nordic_walking: IconTrekking,
  hiking: IconMountain,
  dog_walking: IconDog,
  stair_climbing: IconStairsUp,
  climbing: IconMountain,
  swimming: IconSwimming,
  open_water: IconSwimming,
  water_polo: IconSwimming,
  aqua_fitness: IconPool,
  rowing: IconKayak,
  rowing_machine: IconKayak,
  kayaking: IconKayak,
  canoeing: IconKayak,
  sup: IconKayak,
  surfing: IconWaveSine,
  windsurfing: IconSailboat,
  cardio: IconHeartbeat,
  hiit: IconHeartbeat,
  circuit: IconHeartbeat,
  elliptical: IconHeartbeat,
  aerobics: IconHeartbeat,
  strength: IconBarbell,
  crossfit: IconBarbell,
  bootcamp: IconBarbell,
  kettlebell: IconBarbell,
  bodyweight: IconGymnastics,
  jump_rope: IconJumpRope,
  trampoline: IconGymnastics,
  yoga: IconYoga,
  pilates: IconStretching,
  dance: IconMusic,
  zumba: IconMusic,
  ballet: IconMusic,
  boxing: IconKarate,
  kickboxing: IconKarate,
  martial_arts: IconKarate,
  wrestling: IconKarate,
  fencing: IconSwords,
  football: IconBallFootball,
  handball: IconPlayHandball,
  basketball: IconBallBasketball,
  volleyball: IconBallVolleyball,
  floorball: IconActivity,
  ice_hockey: IconIceSkating,
  rugby: IconActivity,
  ultimate: IconDisc,
  tennis: IconBallTennis,
  padel: IconBallTennis,
  badminton: IconBallTennis,
  squash: IconBallTennis,
  table_tennis: IconPingPong,
  golf: IconGolf,
  ski: IconSnowflake,
  cross_country_ski: IconSnowflake,
  snowboard: IconSnowboarding,
  ice_skating: IconIceSkating,
  snow_shoveling: IconShovel,
  inline_skating: IconSkateboarding,
  skateboarding: IconSkateboarding,
  horse_riding: IconHorse,
  gardening: IconPlant,
  woodcutting: IconAxe,
  moving: IconBox,
  housework: IconHome,
  playing_kids: IconMoodKid,
  other: IconActivity,
};

// Shared sport-type catalog. `key` is stored on Activity.sportType (free text,
// but we normalize to these keys where we can, see
// src/app/api/integrations/fitbit/sync). Used by the calendar's sport icon
// (Checkpoint 3), Statistics' sport blocks (Checkpoint 4) and the activity
// search under Tilføj → Aktivitet.
export const SPORT_TYPES: { key: string; label: string; icon: Icon; words: string[] }[] = ACTIVITY_CATALOG.map((entry) => ({
  key: entry.key,
  label: entry.label,
  icon: SPORT_ICONS[entry.key] ?? IconActivity,
  words: entry.words ?? [],
}));

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
