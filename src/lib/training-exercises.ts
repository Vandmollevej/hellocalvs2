// Træningspas (bruger 2026-10-17): øvelseskatalog til styrketræning på
// maskiner, løsvægte og crossfit. Hver øvelse har dansk og engelsk navn —
// søgningen matcher begge sprog uanset appens sprog. Billederne ligger i
// public/training/<key>.webp og stammer fra Free Exercise DB
// (github.com/yuhonas/free-exercise-db, Unlicense/public domain), beskåret
// til kvadrat og komprimeret. Native henter kataloget via
// GET /api/training-exercises, så listen kun findes her.

export const TRAINING_CATEGORIES = ["machines", "free_weights", "crossfit"] as const;
export type TrainingCategory = (typeof TRAINING_CATEGORIES)[number];

/** Aktivitetens sportstype for hver kategori (ACTIVITY_CATALOG i activity-met.ts). */
export const TRAINING_SPORT: Record<TrainingCategory, string> = {
  machines: "strength",
  free_weights: "strength",
  crossfit: "crossfit",
};

export type TrainingExercise = { key: string; category: TrainingCategory; da: string; en: string };

export const TRAINING_EXERCISES: TrainingExercise[] = [
  { key: "leg_press", category: "machines", da: "Benpres", en: "Leg press" },
  { key: "leg_extensions", category: "machines", da: "Benstræk i maskine", en: "Leg extension" },
  { key: "seated_leg_curl", category: "machines", da: "Siddende hasecurl", en: "Seated leg curl" },
  { key: "lying_leg_curls", category: "machines", da: "Liggende hasecurl", en: "Lying leg curl" },
  { key: "hack_squat", category: "machines", da: "Hack squat", en: "Hack squat" },
  { key: "calf_press_on_the_leg_press_machine", category: "machines", da: "Lægpres i benpres", en: "Calf press" },
  { key: "seated_calf_raise", category: "machines", da: "Siddende tåhævninger", en: "Seated calf raise" },
  { key: "thigh_abductor", category: "machines", da: "Abduktormaskine (lår udad)", en: "Hip abductor machine" },
  { key: "thigh_adductor", category: "machines", da: "Adduktormaskine (lår indad)", en: "Hip adductor machine" },
  { key: "glute_ham_raise", category: "machines", da: "Glute-ham raise", en: "Glute-ham raise" },
  { key: "machine_bench_press", category: "machines", da: "Brystpres i maskine", en: "Machine chest press" },
  { key: "leverage_incline_chest_press", category: "machines", da: "Skrå brystpres i maskine", en: "Incline machine chest press" },
  { key: "butterfly", category: "machines", da: "Butterfly (pec deck)", en: "Pec deck fly" },
  { key: "reverse_machine_flyes", category: "machines", da: "Omvendt butterfly", en: "Reverse pec deck" },
  { key: "cable_crossover", category: "machines", da: "Kabelcrossover", en: "Cable crossover" },
  { key: "machine_shoulder_military_press", category: "machines", da: "Skulderpres i maskine", en: "Machine shoulder press" },
  { key: "face_pull", category: "machines", da: "Face pull", en: "Face pull" },
  { key: "wide_grip_lat_pulldown", category: "machines", da: "Lat pulldown, bredt greb", en: "Wide-grip lat pulldown" },
  { key: "close_grip_front_lat_pulldown", category: "machines", da: "Lat pulldown, smalt greb", en: "Close-grip lat pulldown" },
  { key: "straight_arm_pulldown", category: "machines", da: "Strakarm-pulldown", en: "Straight-arm pulldown" },
  { key: "seated_cable_rows", category: "machines", da: "Siddende kabelroning", en: "Seated cable row" },
  { key: "leverage_iso_row", category: "machines", da: "Roning i maskine", en: "Machine row" },
  { key: "leverage_high_row", category: "machines", da: "Høj roning i maskine", en: "High row machine" },
  { key: "machine_bicep_curl", category: "machines", da: "Bicepscurl i maskine", en: "Machine biceps curl" },
  { key: "machine_preacher_curls", category: "machines", da: "Preacher curl i maskine", en: "Machine preacher curl" },
  { key: "standing_biceps_cable_curl", category: "machines", da: "Bicepscurl i kabel", en: "Cable biceps curl" },
  { key: "triceps_pushdown", category: "machines", da: "Triceps pushdown", en: "Triceps pushdown" },
  { key: "triceps_pushdown_rope_attachment", category: "machines", da: "Triceps pushdown med reb", en: "Rope triceps pushdown" },
  { key: "machine_triceps_extension", category: "machines", da: "Tricepsstræk i maskine", en: "Machine triceps extension" },
  { key: "dip_machine", category: "machines", da: "Dipmaskine", en: "Dip machine" },
  { key: "ab_crunch_machine", category: "machines", da: "Mavebøjning i maskine", en: "Ab crunch machine" },
  { key: "cable_crunch", category: "machines", da: "Kabelcrunch", en: "Cable crunch" },
  { key: "pallof_press", category: "machines", da: "Pallof-pres", en: "Pallof press" },
  { key: "standing_cable_wood_chop", category: "machines", da: "Brændehugger i kabel", en: "Cable wood chop" },
  { key: "smith_machine_squat", category: "machines", da: "Squat i smithmaskine", en: "Smith machine squat" },
  { key: "smith_machine_bench_press", category: "machines", da: "Bænkpres i smithmaskine", en: "Smith machine bench press" },
  { key: "barbell_squat", category: "free_weights", da: "Squat med vægtstang", en: "Barbell back squat" },
  { key: "front_barbell_squat", category: "free_weights", da: "Frontsquat", en: "Front squat" },
  { key: "barbell_deadlift", category: "free_weights", da: "Dødløft", en: "Deadlift" },
  { key: "romanian_deadlift", category: "free_weights", da: "Rumænsk dødløft", en: "Romanian deadlift" },
  { key: "sumo_deadlift", category: "free_weights", da: "Sumodødløft", en: "Sumo deadlift" },
  { key: "barbell_bench_press_medium_grip", category: "free_weights", da: "Bænkpres", en: "Bench press" },
  { key: "barbell_incline_bench_press_medium_grip", category: "free_weights", da: "Skrå bænkpres", en: "Incline bench press" },
  { key: "close_grip_barbell_bench_press", category: "free_weights", da: "Bænkpres, smalt greb", en: "Close-grip bench press" },
  { key: "standing_military_press", category: "free_weights", da: "Militærpres", en: "Overhead press" },
  { key: "bent_over_barbell_row", category: "free_weights", da: "Foroverbøjet roning med stang", en: "Bent-over barbell row" },
  { key: "upright_barbell_row", category: "free_weights", da: "Opret roning", en: "Upright row" },
  { key: "barbell_shrug", category: "free_weights", da: "Skuldertræk med stang", en: "Barbell shrug" },
  { key: "good_morning", category: "free_weights", da: "Good morning", en: "Good morning" },
  { key: "barbell_hip_thrust", category: "free_weights", da: "Hip thrust", en: "Hip thrust" },
  { key: "barbell_lunge", category: "free_weights", da: "Udfald med vægtstang", en: "Barbell lunge" },
  { key: "barbell_curl", category: "free_weights", da: "Bicepscurl med stang", en: "Barbell curl" },
  { key: "ez_bar_curl", category: "free_weights", da: "Curl med EZ-stang", en: "EZ-bar curl" },
  { key: "ez_bar_skullcrusher", category: "free_weights", da: "Skullcrusher", en: "Skull crusher" },
  { key: "dumbbell_bench_press", category: "free_weights", da: "Bænkpres med håndvægte", en: "Dumbbell bench press" },
  { key: "incline_dumbbell_press", category: "free_weights", da: "Skrå pres med håndvægte", en: "Incline dumbbell press" },
  { key: "dumbbell_flyes", category: "free_weights", da: "Flyes med håndvægte", en: "Dumbbell fly" },
  { key: "straight_arm_dumbbell_pullover", category: "free_weights", da: "Pullover med håndvægt", en: "Dumbbell pullover" },
  { key: "dumbbell_shoulder_press", category: "free_weights", da: "Skulderpres med håndvægte", en: "Dumbbell shoulder press" },
  { key: "arnold_dumbbell_press", category: "free_weights", da: "Arnoldpres", en: "Arnold press" },
  { key: "side_lateral_raise", category: "free_weights", da: "Sidehævninger", en: "Lateral raise" },
  { key: "front_dumbbell_raise", category: "free_weights", da: "Fronthævninger", en: "Front raise" },
  { key: "reverse_flyes", category: "free_weights", da: "Omvendte flyes", en: "Reverse fly" },
  { key: "one_arm_dumbbell_row", category: "free_weights", da: "Etarms roning med håndvægt", en: "One-arm dumbbell row" },
  { key: "dumbbell_shrug", category: "free_weights", da: "Skuldertræk med håndvægte", en: "Dumbbell shrug" },
  { key: "dumbbell_bicep_curl", category: "free_weights", da: "Bicepscurl med håndvægte", en: "Dumbbell biceps curl" },
  { key: "hammer_curls", category: "free_weights", da: "Hammercurl", en: "Hammer curl" },
  { key: "concentration_curls", category: "free_weights", da: "Koncentrationscurl", en: "Concentration curl" },
  { key: "tricep_dumbbell_kickback", category: "free_weights", da: "Triceps kickback", en: "Triceps kickback" },
  { key: "standing_dumbbell_triceps_extension", category: "free_weights", da: "Tricepsstræk over hovedet", en: "Overhead triceps extension" },
  { key: "goblet_squat", category: "free_weights", da: "Goblet squat", en: "Goblet squat" },
  { key: "dumbbell_lunges", category: "free_weights", da: "Udfald med håndvægte", en: "Dumbbell lunge" },
  { key: "split_squat_with_dumbbells", category: "free_weights", da: "Split squat med håndvægte", en: "Dumbbell split squat" },
  { key: "dumbbell_step_ups", category: "free_weights", da: "Step-up med håndvægte", en: "Dumbbell step-up" },
  { key: "stiff_legged_dumbbell_deadlift", category: "free_weights", da: "Strakbenet dødløft med håndvægte", en: "Stiff-legged dumbbell deadlift" },
  { key: "standing_dumbbell_calf_raise", category: "free_weights", da: "Tåhævninger med håndvægte", en: "Dumbbell calf raise" },
  { key: "clean_and_jerk", category: "crossfit", da: "Stød (clean and jerk)", en: "Clean and jerk" },
  { key: "snatch", category: "crossfit", da: "Træk (snatch)", en: "Snatch" },
  { key: "power_clean", category: "crossfit", da: "Frivending (power clean)", en: "Power clean" },
  { key: "hang_clean", category: "crossfit", da: "Hang clean", en: "Hang clean" },
  { key: "push_press", category: "crossfit", da: "Push press", en: "Push press" },
  { key: "overhead_squat", category: "crossfit", da: "Overhead squat", en: "Overhead squat" },
  { key: "kettlebell_thruster", category: "crossfit", da: "Thruster", en: "Thruster" },
  { key: "one_arm_kettlebell_swings", category: "crossfit", da: "Kettlebell swing", en: "Kettlebell swing" },
  { key: "kettlebell_sumo_high_pull", category: "crossfit", da: "Sumo high pull", en: "Sumo deadlift high pull" },
  { key: "kettlebell_turkish_get_up_squat_style", category: "crossfit", da: "Tyrkisk get-up", en: "Turkish get-up" },
  { key: "kettlebell_pistol_squat", category: "crossfit", da: "Pistol squat", en: "Pistol squat" },
  { key: "alternating_renegade_row", category: "crossfit", da: "Renegade row", en: "Renegade row" },
  { key: "pullups", category: "crossfit", da: "Pull-ups", en: "Pull-ups" },
  { key: "chin_up", category: "crossfit", da: "Chin-ups", en: "Chin-ups" },
  { key: "kipping_muscle_up", category: "crossfit", da: "Muscle-up", en: "Muscle-up" },
  { key: "ring_dips", category: "crossfit", da: "Ringdips", en: "Ring dips" },
  { key: "pushups", category: "crossfit", da: "Armstrækninger", en: "Push-ups" },
  { key: "handstand_push_ups", category: "crossfit", da: "Håndstandsarmstrækninger", en: "Handstand push-ups" },
  { key: "bodyweight_squat", category: "crossfit", da: "Squat uden vægt", en: "Air squat" },
  { key: "freehand_jump_squat", category: "crossfit", da: "Squathop", en: "Jump squat" },
  { key: "front_box_jump", category: "crossfit", da: "Bokshop", en: "Box jump" },
  { key: "mountain_climbers", category: "crossfit", da: "Mountain climbers", en: "Mountain climbers" },
  { key: "rope_jumping", category: "crossfit", da: "Sjippetov", en: "Jump rope" },
  { key: "rope_climb", category: "crossfit", da: "Rebklatring", en: "Rope climb" },
  { key: "battling_ropes", category: "crossfit", da: "Battle ropes", en: "Battle ropes" },
  { key: "overhead_slam", category: "crossfit", da: "Boldslam", en: "Ball slam" },
  { key: "farmers_walk", category: "crossfit", da: "Farmer's walk", en: "Farmer's walk" },
  { key: "sled_push", category: "crossfit", da: "Slædeskub", en: "Sled push" },
  { key: "tire_flip", category: "crossfit", da: "Dækvending", en: "Tire flip" },
  { key: "rowing_stationary", category: "crossfit", da: "Romaskine", en: "Rowing machine" },
  { key: "hanging_leg_raise", category: "crossfit", da: "Hængende benløft", en: "Hanging leg raise" },
  { key: "sit_up", category: "crossfit", da: "Mavebøjninger (sit-ups)", en: "Sit-ups" },
  { key: "russian_twist", category: "crossfit", da: "Russian twist", en: "Russian twist" },
  { key: "plank", category: "crossfit", da: "Planke", en: "Plank" },
];

const BY_KEY = new Map(TRAINING_EXERCISES.map((exercise) => [exercise.key, exercise]));

export function trainingExercise(key: string): TrainingExercise | undefined {
  return BY_KEY.get(key);
}

export function trainingImage(key: string): string {
  return `/training/${key}.webp`;
}

/** Navnet i appens sprog: dansk for "da", ellers engelsk. */
export function trainingName(exercise: TrainingExercise, locale: string): string {
  return locale === "da" ? exercise.da : exercise.en;
}

function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[-_'’]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Søg i en kategori på både dansk og engelsk. Alle ord skal findes (i et af
 * sprogene); navne, der begynder med søgningen, kommer først.
 */
export function searchTrainingExercises(category: TrainingCategory, query: string): TrainingExercise[] {
  const list = TRAINING_EXERCISES.filter((exercise) => exercise.category === category);
  const needle = fold(query);
  if (!needle) return list;
  const words = needle.split(" ");
  const hits = list.filter((exercise) => {
    const haystack = `${fold(exercise.da)} ${fold(exercise.en)}`;
    return words.every((word) => haystack.includes(word));
  });
  const starts = (exercise: TrainingExercise) =>
    fold(exercise.da).startsWith(needle) || fold(exercise.en).startsWith(needle) ? 0 : 1;
  return hits.sort((a, b) => starts(a) - starts(b));
}

export type TrainingSet = { weightKg: number; reps: number };
export type TrainingEntry = { key: string; sets: TrainingSet[] };

export const MAX_TRAINING_WEIGHT_KG = 300;
export const MAX_TRAINING_REPS = 100;

/**
 * Validerer øvelserne fra klienten (POST /api/activities). Ukendte øvelser og
 * ugyldige sæt smides væk; null når intet er tilbage.
 */
export function parseTrainingEntries(value: unknown): TrainingEntry[] | null {
  if (!Array.isArray(value)) return null;
  const entries: TrainingEntry[] = [];
  for (const raw of value.slice(0, 50)) {
    if (!raw || typeof raw !== "object") continue;
    const { key, sets } = raw as { key?: unknown; sets?: unknown };
    if (typeof key !== "string" || !BY_KEY.has(key) || !Array.isArray(sets)) continue;
    const clean: TrainingSet[] = [];
    for (const set of sets.slice(0, 30)) {
      if (!set || typeof set !== "object") continue;
      const weight = Number((set as { weightKg?: unknown }).weightKg);
      const reps = Number((set as { reps?: unknown }).reps);
      if (!Number.isFinite(weight) || weight < 0 || weight > MAX_TRAINING_WEIGHT_KG) continue;
      if (!Number.isInteger(reps) || reps < 1 || reps > MAX_TRAINING_REPS) continue;
      clean.push({ weightKg: Math.round(weight * 2) / 2, reps });
    }
    if (clean.length > 0) entries.push({ key, sets: clean });
  }
  return entries.length > 0 ? entries : null;
}
