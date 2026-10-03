import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidStartWeight, parseWeightInput } from "@/lib/start-weight-verification";
import { unauthorized } from "@/lib/session";
import { getProfileUser } from "@/lib/family-access";
import { getUserSubscriptionTier } from "@/lib/subscription";
import { isActivityLevel } from "@/lib/activity-level";
import { applyManualLevel } from "@/lib/activity-profile";
import { GOAL_MODES, type GoalMode } from "@/lib/energy-budget";
import { normalizePhone } from "@/lib/phone";

export async function GET() {
  try {
    const user = await getProfileUser("profile", "VIEWED");

    if (!user) return unauthorized();
    // Loginhemmeligheder sendes aldrig til klienten — heller ikke når en
    // forælder ser et barns profil (docs/FAMILY.md).
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, totpSecret, ...safeUser } = user;
    // Allergenvisning er kun for Seriøs (docs/DECISIONS.md 2026-09-26); den
    // gemte præference bevares og virker igen ved opgradering.
    const tier = await getUserSubscriptionTier(user.id);
    return NextResponse.json({ user: tier === "SERIOUS" ? safeUser : { ...safeUser, showAllergens: false } });
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
    phone,
    weightKg,
    targetWeightKg,
    heightCm,
    birthDate,
    sex,
    activityLevel,
    goalMode,
    goalPaceKgPerWeek,
    cycleTrackingEnabled,
    sleepQualityPromptEnabled,
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
    showAdditives,
    showToxins,
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
    phone?: string | null;
    weightKg?: unknown;
    targetWeightKg?: number | null;
    heightCm?: number | null;
    birthDate?: string | null;
    sex?: "FEMALE" | "MALE" | null;
    activityLevel?: unknown;
    goalMode?: unknown;
    goalPaceKgPerWeek?: number | null;
    cycleTrackingEnabled?: boolean;
    sleepQualityPromptEnabled?: boolean;
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
    showAdditives?: boolean;
    showToxins?: boolean;
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
    const user = await getProfileUser("profile", "UPDATED");

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

    // Mobilnummer til SMS-gendannelse: tomt felt fjerner nummeret.
    let normalizedPhone: string | null | undefined;
    if (phone !== undefined) {
      if (phone === null || phone.trim() === "") normalizedPhone = null;
      else {
        normalizedPhone = normalizePhone(phone);
        if (!normalizedPhone) {
          return NextResponse.json({ message: "Angiv et gyldigt mobilnummer." }, { status: 400 });
        }
      }
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        displayName,
        phone: normalizedPhone,
        // Et nyt nummer er ikke bekræftet endnu.
        phoneVerifiedAt: normalizedPhone !== undefined && normalizedPhone !== user.phone ? null : undefined,
        weightKg: initialWeightKg,
        startWeightUpdatedAt: initialWeightKg !== undefined ? new Date() : undefined,
        targetWeightKg,
        heightCm,
        birthDate:
          birthDate === undefined ? undefined : birthDate === null ? null : new Date(birthDate),
        sex,
        activityLevel:
          activityLevel === undefined ? undefined : activityLevel === null ? null : isActivityLevel(activityLevel) ? activityLevel : undefined,
        // Kaloriemål (docs/ACTIVITY-PAL.md): ønsket tempo gemmes som brugerens
        // ønske; det anvendte tempo regnes i energy-budget.ts inden for grænserne.
        goalMode:
          goalMode === undefined ? undefined : goalMode === null ? null : (GOAL_MODES as readonly string[]).includes(goalMode as string) ? (goalMode as GoalMode) : undefined,
        goalPaceKgPerWeek:
          goalPaceKgPerWeek === undefined ? undefined : goalPaceKgPerWeek === null ? null : goalPaceKgPerWeek > 0 && goalPaceKgPerWeek <= 2 ? goalPaceKgPerWeek : undefined,
        cycleTrackingEnabled,
        sleepQualityPromptEnabled,
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
        showAdditives,
        showToxins,
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

    // Vælger brugeren niveauet selv, gælder niveauets PAL (kilde MANUAL) —
    // docs/ACTIVITY-PAL.md.
    const finalUser = isActivityLevel(activityLevel) ? await applyManualLevel(user.id, activityLevel) : updated;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, totpSecret, ...safeUpdated } = finalUser;
    return NextResponse.json({ user: safeUpdated });
  } catch (error) {
    console.error("Profile update failed", error);
    return NextResponse.json(
      { message: "Database ikke tilgængelig" },
      { status: 503 }
    );
  }
}
