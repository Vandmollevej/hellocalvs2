"use client";

import Link from "next/link";
import { IconChevronDown } from "@tabler/icons-react";
import { NotchedTextField } from "@/components/hf/NotchedTextField";
import { Toggle } from "@/components/ui/Toggle";
import { useTranslation } from "@/i18n/LocaleProvider";
import {
  DOCTOR_SHARE_CATEGORIES,
  DOCTOR_SHARE_UNAVAILABLE_CATEGORIES,
  DOCTOR_SHARE_HISTORY_RANGES,
  type DoctorShareCategory,
  type DoctorShareHistoryRange,
} from "@/lib/doctor-share";

const CATEGORY_LABEL_KEY: Record<DoctorShareCategory, string> = {
  profile: "helloDoc.categoryProfile",
  weight: "helloDoc.categoryWeight",
  goals: "helloDoc.categoryGoals",
  menstrualCycle: "helloDoc.categoryMenstrualCycle",
  digestion: "helloDoc.categoryDigestion",
  sleep: "helloDoc.categorySleep",
  foodAndCalories: "helloDoc.categoryFoodAndCalories",
  vitaminsMinerals: "helloDoc.categoryVitaminsMinerals",
  fluid: "helloDoc.categoryFluid",
};

// digestion was explicitly called out by the user as "kommer senere"; the
// other unavailable category (menstrualCycle) has no such framing, so it
// gets the more general "not yet available" wording instead.
const UNAVAILABLE_LABEL_KEY: Partial<Record<DoctorShareCategory, string>> = {
  digestion: "helloDoc.categoryComingSoon",
};

const HISTORY_LABEL_KEY: Record<DoctorShareHistoryRange, string> = {
  LAST_7_DAYS: "helloDoc.historyLast7Days",
  LAST_MONTH: "helloDoc.historyLastMonth",
  LAST_YEAR: "helloDoc.historyLastYear",
  ALL: "helloDoc.historyAll",
};

// Shared body used by both the "Inviter bruger" (new) page and the
// already-invited-user edit page (docs/DECISIONS.md 2026-09-12) — the user
// asked for these two screens to be "almost identical".
export function DoctorShareEditor({
  name,
  onNameChange,
  email,
  onEmailChange,
  categories,
  onCategoriesChange,
  historyRange,
  onHistoryRangeChange,
  previewHref,
}: {
  name: string;
  onNameChange: (value: string) => void;
  email: string;
  onEmailChange: (value: string) => void;
  categories: DoctorShareCategory[];
  onCategoriesChange: (categories: DoctorShareCategory[]) => void;
  historyRange: DoctorShareHistoryRange;
  onHistoryRangeChange: (range: DoctorShareHistoryRange) => void;
  previewHref: string;
}) {
  const { t } = useTranslation();

  function toggleCategory(category: DoctorShareCategory, checked: boolean) {
    if (checked) onCategoriesChange([...categories, category]);
    else onCategoriesChange(categories.filter((c) => c !== category));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <NotchedTextField
          label={t("helloDoc.nameLabel")}
          value={name}
          placeholder={t("helloDoc.namePlaceholder")}
          onChange={(event) => onNameChange(event.target.value)}
        />
        <NotchedTextField
          label={t("helloDoc.emailLabel")}
          type="email"
          value={email}
          placeholder={t("helloDoc.emailPlaceholder")}
          onChange={(event) => onEmailChange(event.target.value)}
        />
      </div>

      <Link
        href={previewHref}
        className="hf-btn-secondary hf-type-button flex h-12 w-full items-center justify-center bg-hf-white"
      >
        {t("helloDoc.previewButton")}
      </Link>

      <div>
        <h2 className="hf-type-section-title mb-3">{t("helloDoc.shareDataTitle")}</h2>
        <div className="flex flex-col gap-2">
          {DOCTOR_SHARE_CATEGORIES.map((category) => {
            const unavailable = DOCTOR_SHARE_UNAVAILABLE_CATEGORIES.includes(category);
            return (
              <Toggle
                key={category}
                label={t(CATEGORY_LABEL_KEY[category])}
                description={unavailable ? t(UNAVAILABLE_LABEL_KEY[category] ?? "helloDoc.categoryUnavailable") : undefined}
                checked={!unavailable && categories.includes(category)}
                disabled={unavailable}
                onChange={(checked) => toggleCategory(category, checked)}
              />
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="hf-type-section-title mb-3">{t("helloDoc.historyTitle")}</h2>
        <div className="relative">
          <select
            className="hf-type-input h-12 w-full appearance-none rounded-[8px] border bg-hf-cream pl-4 pr-10 outline-none"
            style={{ borderColor: "var(--hf-color-field-border)" }}
            value={historyRange}
            onChange={(event) => onHistoryRangeChange(event.target.value as DoctorShareHistoryRange)}
          >
            {DOCTOR_SHARE_HISTORY_RANGES.map((range) => (
              <option key={range} value={range}>
                {t(HISTORY_LABEL_KEY[range])}
              </option>
            ))}
          </select>
          <IconChevronDown
            size={18}
            stroke={2.5}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-hf-black"
          />
        </div>
      </div>
    </div>
  );
}
