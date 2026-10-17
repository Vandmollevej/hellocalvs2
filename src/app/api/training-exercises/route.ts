import { NextResponse } from "next/server";
import { TRAINING_CATEGORIES, TRAINING_EXERCISES, TRAINING_SPORT, trainingImage } from "@/lib/training-exercises";

// GET /api/training-exercises — øvelseskataloget til Træningspas (native
// henter det her; web importerer src/lib/training-exercises.ts direkte).
export function GET() {
  return NextResponse.json(
    {
      categories: TRAINING_CATEGORIES.map((key) => ({ key, sportType: TRAINING_SPORT[key] })),
      exercises: TRAINING_EXERCISES.map((exercise) => ({ ...exercise, image: trainingImage(exercise.key) })),
    },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
