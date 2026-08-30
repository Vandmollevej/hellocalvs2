import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDemoUser } from "@/lib/demo-user";

export async function GET() {
  try {
    const user = await getDemoUser();
    return NextResponse.json({ user });
  } catch (error) {
    console.error("Profile fetch failed", error);
    return NextResponse.json(
      { message: "Database ikke tilgængelig" },
      { status: 503 }
    );
  }
}

// PATCH /api/profile — gemmer løbende, jf. UI-princippet om ingen "Gem"-knap.
export async function PATCH(req: Request) {
  const body = await req.json();
  const {
    displayName,
    weightKg,
    heightCm,
    birthYear,
    sex,
    defaultBedtime,
    defaultWakeTime,
    shiftWorkEnabled,
    dailyLogPreference,
    workHoursInCalendarEnabled,
    healthImportRequested,
    onboardingStep,
    onboardingCompletedAt,
    onboardingRemindLaterAt,
    onboardingDismissed,
    showAllergens,
    allergenVisibility,
    region,
  } = body as {
    displayName?: string;
    weightKg?: number | null;
    heightCm?: number | null;
    birthYear?: number | null;
    sex?: "FEMALE" | "MALE" | null;
    defaultBedtime?: string | null;
    defaultWakeTime?: string | null;
    shiftWorkEnabled?: boolean;
    dailyLogPreference?: "WORK_HOURS" | "SLEEP_TIMES" | null;
    workHoursInCalendarEnabled?: boolean;
    healthImportRequested?: boolean;
    onboardingStep?: number;
    onboardingCompletedAt?: string | null;
    onboardingRemindLaterAt?: string | null;
    onboardingDismissed?: boolean;
    showAllergens?: boolean;
    allergenVisibility?: Record<string, boolean>;
    region?: string;
  };

  try {
    const user = await getDemoUser();
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        displayName,
        weightKg,
        heightCm,
        birthYear,
        sex,
        defaultBedtime,
        defaultWakeTime,
        shiftWorkEnabled,
        dailyLogPreference,
        workHoursInCalendarEnabled,
        healthImportRequested,
        onboardingStep,
        onboardingCompletedAt:
          onboardingCompletedAt === undefined
            ? undefined
            : onboardingCompletedAt === null
              ? null
              : new Date(onboardingCompletedAt),
        onboardingRemindLaterAt:
          onboardingRemindLaterAt === undefined
            ? undefined
            : onboardingRemindLaterAt === null
              ? null
              : new Date(onboardingRemindLaterAt),
        onboardingDismissed,
        showAllergens,
        allergenVisibility,
        region,
      },
    });

    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error("Profile update failed", error);
    return NextResponse.json(
      { message: "Database ikke tilgængelig" },
      { status: 503 }
    );
  }
}
