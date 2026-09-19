"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { HfScreen } from "@/components/HfScreen";
import { Toggle } from "@/components/ui/Toggle";
import {
  MAX_WHEEL_ACTIONS,
  saveWheelActionKeys,
  useAddActionsProfile,
  useWheelActionKeys,
  visibleAddActions,
  type AddActionKey,
} from "@/lib/add-actions";
import { oppositeSide, saveFabSide, useFabSide, type FabSide } from "@/lib/frontpage-layout";
import {
  FRONTPAGE_STAT_DEFS,
  saveFrontpageStatKeys,
  useFrontpageStatKeys,
  type FrontpageStatKey,
} from "@/lib/frontpage-stats";
import { useTranslation } from "@/i18n/LocaleProvider";

// Settings → Visning → Forside: which of the catalog's add-elements
// (src/lib/add-actions.ts) fill the front page's joystick wheel (excluding
// its fixed top "list" slot, which always opens /add/menu with everything),
// which screen edge the wheel/number-slider pair sits on
// (src/lib/frontpage-layout.ts), and which fields the number-slider itself
// shows (src/lib/frontpage-stats.ts). All three are per-device preferences,
// same as the statistics page's card layout (StatCardsGrid.tsx) — stored in
// localStorage, not the database.
export default function FrontPageDisplaySettingsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const selectedKeys = useWheelActionKeys();
  const profile = useAddActionsProfile();
  const actions = visibleAddActions(profile);
  const fabSide = useFabSide();
  const activeStatKeys = useFrontpageStatKeys();

  function toggle(key: AddActionKey, checked: boolean) {
    const current = new Set(selectedKeys);
    if (checked) {
      if (current.size >= MAX_WHEEL_ACTIONS) return;
      current.add(key);
    } else {
      current.delete(key);
    }
    const ordered = actions.map((action) => action.key).filter((k) => current.has(k));
    saveWheelActionKeys(ordered);
  }

  function toggleStat(key: FrontpageStatKey, checked: boolean) {
    const current = new Set(activeStatKeys);
    if (checked) current.add(key);
    else current.delete(key);
    const ordered = FRONTPAGE_STAT_DEFS.map((def) => def.key).filter((k) => current.has(k));
    saveFrontpageStatKeys(ordered);
  }

  const atMax = selectedKeys.length >= MAX_WHEEL_ACTIONS;

  return (
    <HfScreen title={t("settings.frontPage")} onBack={() => router.back()}>
      <div className="flex flex-col gap-4 p-4">
        <div className="rounded-2xl bg-hf-green px-4 py-4 text-hf-white">
          <p className="text-[13px] leading-5">{t("frontPageSettings.intro")}</p>
        </div>

        <p className="hf-heading px-1 text-xs font-bold uppercase tracking-wide text-hf-black opacity-60">
          {t("frontPageSettings.sideSectionTitle")}
        </p>
        <div className="grid grid-cols-2 gap-3">
          {(["left", "right"] as FabSide[]).map((side) => {
            const isSelected = fabSide === side;
            return (
              <button
                key={side}
                type="button"
                onClick={() => saveFabSide(side)}
                className="flex h-12 items-center justify-center rounded-2xl text-[14px] font-semibold transition-colors"
                style={{
                  background: isSelected ? "var(--hf-green)" : "var(--hf-tan)",
                  color: isSelected ? "var(--hf-white)" : "var(--hf-black)",
                }}
                aria-pressed={isSelected}
              >
                {t(side === "left" ? "frontPageSettings.sideLeft" : "frontPageSettings.sideRight")}
              </button>
            );
          })}
        </div>
        <p className="px-1 text-[12px] text-hf-black opacity-60">
          {t("frontPageSettings.sideHint", {
            side: t(oppositeSide(fabSide) === "left" ? "frontPageSettings.sideLeft" : "frontPageSettings.sideRight"),
          })}
        </p>

        <p className="hf-heading px-1 text-xs font-bold uppercase tracking-wide text-hf-black opacity-60">
          {t("frontPageSettings.buttonsSectionTitle")}
        </p>
        <p className="px-1 text-[13px] font-semibold text-hf-black opacity-70">
          {t("frontPageSettings.selectedCount", { count: selectedKeys.length, max: MAX_WHEEL_ACTIONS })}
        </p>

        <div className="flex flex-col gap-1 overflow-hidden rounded-2xl bg-hf-tan">
          {actions.map((action, index) => {
            const checked = selectedKeys.includes(action.key);
            const Icon = action.icon;
            return (
              <div
                key={action.key}
                className={`flex items-center gap-3 px-4 py-3 ${
                  index < actions.length - 1 ? "border-b border-hf-tan-dark" : ""
                }`}
              >
                <span className="flex h-5 w-5 items-center justify-center text-hf-black">
                  {Icon ? (
                    <Icon size={20} />
                  ) : (
                    <Image src={action.imageSrc!} alt="" width={20} height={20} className="object-contain" />
                  )}
                </span>
                <span className="flex-1 text-[14px] text-hf-black">{t(action.labelKey)}</span>
                <Toggle
                  checked={checked}
                  disabled={!checked && atMax}
                  onChange={(value) => toggle(action.key, value)}
                />
              </div>
            );
          })}
        </div>

        {atMax && (
          <p className="px-1 text-[12px] text-hf-black opacity-60">{t("frontPageSettings.maxReachedHint")}</p>
        )}

        <p className="hf-heading px-1 text-xs font-bold uppercase tracking-wide text-hf-black opacity-60">
          {t("frontPageSettings.statsSectionTitle")}
        </p>
        <p className="px-1 text-[13px] leading-5 text-hf-black opacity-70">
          {t("frontPageSettings.statsIntro")}
        </p>

        <div className="flex flex-col gap-1 overflow-hidden rounded-2xl bg-hf-tan">
          {FRONTPAGE_STAT_DEFS.map((def, index) => {
            const checked = activeStatKeys.includes(def.key);
            const Icon = def.icon;
            return (
              <div
                key={def.key}
                className={`flex items-center gap-3 px-4 py-3 ${
                  index < FRONTPAGE_STAT_DEFS.length - 1 ? "border-b border-hf-tan-dark" : ""
                }`}
              >
                <span className="flex h-5 w-5 items-center justify-center text-hf-black">
                  <Icon size={20} />
                </span>
                <span className="flex-1 text-[14px] text-hf-black">{t(def.labelKey)}</span>
                <Toggle checked={checked} onChange={(value) => toggleStat(def.key, value)} />
              </div>
            );
          })}
        </div>
      </div>
    </HfScreen>
  );
}
