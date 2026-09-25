import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidStartWeight, parseWeightInput } from "@/lib/start-weight-verification";
import { getSessionUser, unauthorized } from "@/lib/session";

export async function GET() {
  try {
    const user = await getSessionUser();

    if (!user) return unauthorized();
    return NextResponse.json({ user });
  } catch (error) {
    console.error("Profile fetch failed", error);
    return NextResponse.json(
      { message: "Database ikke tilgængelig" },
      { status: 503 }
    );
  }
}

// PATCH /api/profile — saves continuously, per the UI principle of no "Save" button.
export async function PATCH(req: Request) {
  const body = await req.json();
  const {
    displayName,
    weightKg,
    targetWeightKg,
    heightCm,
    birthDate,
    sex,
    cycleTrackingEnabled,
    averageCycleLengthDays,
    averagePeriodLengthDays,
    defaultBedtime,
    defaultWakeTime,
    shiftWorkEnabled,
    dailyLogPreference,
    healthImportRequested,
    onboardingStep,
    onboardingCompletedAt,
    onboardingRemindLaterAt,
    onboardingDismissed,
    showAllergens,
    allergenVisibility,
    showExtendedNutrition,
    warnOnRecommendedLimits,
    autoExpandUncertainty,
    region,
    appLocale,
    photoDiaryRequiresPasscode,
    wantsPushNotifications,
    wantsUpdateNewsEmails,
    wantsAdviceEmails,
    wantsPartnerOffersEmails,
  } = body as {
    displayName?: string;
    weightKg?: unknown;
    targetWeightKg?: number | null;
    heightCm?: number | null;
    birthDate?: string | null;
    sex?: "FEMALE" | "MALE" | null;
    cycleTrackingEnabled?: boolean;
    averageCycleLengthDays?: number;
    averagePeriodLengthDays?: number;
    defaultBedtime?: string | null;
    defaultWakeTime?: string | null;
    shiftWorkEnabled?: boolean;
    dailyLogPreference?: "WORK_HOURS" | "SLEEP_TIMES" | null;
    healthImportRequested?: boolean;
    onboardingStep?: number;
    onboardingCompletedAt?: string | null;
    onboardingRemindLaterAt?: string | null;
    onboardingDismissed?: boolean;
    showAllergens?: boolean;
    allergenVisibility?: Record<string, boolean>;
    showExtendedNutrition?: boolean;
    warnOnRecommendedLimits?: boolean;
    autoExpandUncertainty?: boolean;
    region?: string;
    appLocale?: "da" | "en";
    photoDiaryRequiresPasscode?: boolean;
    wantsPushNotifications?: boolean;
    wantsUpdateNewsEmails?: boolean;
    wantsAdviceEmails?: boolean;
    wantsPartnerOffersEmails?: boolean;
  };

  try {
    const user = await getSessionUser();

    if (!user) return unauthorized();

    // Start-vægten er låst (docs/DECISIONS.md 2026-09-22): her kan den kun
    // sættes første gang (mens den er tom). Enhver senere ændring skal gå
    // gennem det e-mailverificerede flow i /api/profile/start-weight.
    let initialWeightKg: number | undefined;
    if (weightKg !== undefined) {
      const parsed = parseWeightInput(weightKg);
      if (user.weightKg !== null) {
        return NextResponse.json(
          { message: "Startvægten er låst og kan kun ændres via verificeringsmail." },
          { status: 403 }
        );
      }
      if (!isValidStartWeight(parsed)) {
        return NextResponse.json({ message: "Angiv en gyldig startvægt." }, { status: 400 });
      }
      initialWeightKg = parsed;
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        displayName,
        weightKg: initialWeightKg,
        startWeightUpdatedAt: initialWeightKg !== undefined ? new Date() : undefined,
        targetWeightKg,
        heightCm,
        birthDate:
          birthDate === undefined ? undefined : birthDate === null ? null : new Date(birthDate),
        sex,
        cycleTrackingEnabled,
        averageCycleLengthDays,
        averagePeriodLengthDays,
        defaultBedtime,
        defaultWakeTime,
        shiftWorkEnabled,
        dailyLogPreference,
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
        showExtendedNutrition,
        warnOnRecommendedLimits,
        autoExpandUncertainty,
        region,
        appLocale,
        photoDiaryRequiresPasscode,
        wantsPushNotifications,
        wantsUpdateNewsEmails,
        wantsAdviceEmails,
        wantsPartnerOffersEmails,
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
