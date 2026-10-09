"use client";

import Image from "next/image";
import { HfScreen } from "@/components/HfScreen";
import { Toggle } from "@/components/ui/Toggle";
import { FrontPagePreview, WheelIcon } from "@/components/FrontPagePreview";
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
import { savePulseZoneSettings, usePulseZoneSettings } from "@/lib/pulse-zone-settings";
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
  const selectedKeys = useWheelActionKeys();
  const profile = useAddActionsProfile();
  const actions = visibleAddActions(profile);
  const fabSide = useFabSide();
  const activeStatKeys = useFrontpageStatKeys();
  const pulse = usePulseZoneSettings();

  function setZoneBound(index: number, bound: "min" | "max", raw: string) {
    const value = Math.round(Number(raw));
    if (!Number.isFinite(value) || value < 30 || value > 250) return;
    const zones = pulse.zones.map((zone, i) => (i === index ? { ...zone, [bound]: value } : zone));
    if (zones[index].min > zones[index].max) return;
    savePulseZoneSettings({ ...pulse, zones });
  }

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
    <HfScreen title={t("settings.frontPage")}>
      <div className="hf-page">
        <div className="hf-card hf-card--brand">
          <p className="hf-type-small">{t("frontPageSettings.intro")}</p>
        </div>

        <p className="hf-type-small hf-type-strong text-text-secondary hf-heading px-1 uppercase tracking-wide">
          {t("frontPageSettings.sideSectionTitle")}
        </p>
        <div className="grid grid-cols-2 gap-4">
          {(["left", "right"] as FabSide[]).map((side) => {
            const isSelected = fabSide === side;
            return (
              <button
                key={side}
                type="button"
                onClick={() => saveFabSide(side)}
                className={`hf-type-body hf-type-strong flex flex-col items-center justify-center gap-2 rounded-2xl py-3 transition-colors ${
                  isSelected ? "hf-selected" : "bg-hf-tan text-hf-black"
                }`}
                aria-pressed={isSelected}
              >
                <FrontPagePreview side={side} selected={isSelected} />
                {t(side === "left" ? "frontPageSettings.sideLeft" : "frontPageSettings.sideRight")}
              </button>
            );
          })}
        </div>
        <p className="hf-type-small text-text-secondary px-1">
          {t("frontPageSettings.sideHint", {
            side: t(oppositeSide(fabSide) === "left" ? "frontPageSettings.sideLeft" : "frontPageSettings.sideRight"),
          })}
        </p>

        <div className="mt-2 flex items-center gap-3 px-1">
          <WheelIcon />
          <span aria-hidden="true" className="h-px flex-1 bg-hf-black opacity-25" />
          <p className="hf-type-small hf-type-strong text-text-secondary hf-heading uppercase tracking-wide">
            {t("frontPageSettings.buttonsSectionTitle")}
          </p>
          <span aria-hidden="true" className="h-px flex-1 bg-hf-black opacity-25" />
        </div>
        <p className="hf-type-small hf-type-strong text-text-secondary px-1 text-right">
          {t("frontPageSettings.selectedCount", { count: selectedKeys.length, max: MAX_WHEEL_ACTIONS })}
        </p>

        <div className="flex flex-col gap-1 overflow-hidden rounded-2xl bg-hf-tan">
          {actions.map((action, index) => {
            const checked = selectedKeys.includes(action.key);
            const Icon = action.icon;
            return (
              <div
                key={action.key}
                className={`hf-control-row flex items-center gap-3 px-4 ${
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
                <span className="hf-type-body flex-1 text-hf-black">{t(action.labelKey)}</span>
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
          <p className="hf-type-small text-text-secondary px-1">{t("frontPageSettings.maxReachedHint")}</p>
        )}

        <p className="hf-type-small hf-type-strong text-text-secondary hf-heading px-1 uppercase tracking-wide">
          {t("frontPageSettings.statsSectionTitle")}
        </p>
        <p className="hf-type-small text-text-secondary px-1">
          {t("frontPageSettings.statsIntro")}
        </p>

        <div className="flex flex-col gap-1 overflow-hidden rounded-2xl bg-hf-tan">
          {FRONTPAGE_STAT_DEFS.map((def, index) => {
            const checked = activeStatKeys.includes(def.key);
            const Icon = def.icon;
            return (
              <div
                key={def.key}
                className={`hf-control-row flex items-center gap-3 px-4 ${
                  index < FRONTPAGE_STAT_DEFS.length - 1 ? "border-b border-hf-tan-dark" : ""
                }`}
              >
                <span className="flex h-5 w-5 items-center justify-center text-hf-black">
                  <Icon size={20} />
                </span>
                <span className="hf-type-body flex-1 text-hf-black">{t(def.labelKey)}</span>
                <Toggle checked={checked} onChange={(value) => toggleStat(def.key, value)} />
              </div>
            );
          })}
        </div>

        <p className="hf-type-small hf-type-strong text-text-secondary hf-heading px-1 uppercase tracking-wide">
          {t("frontPageSettings.zonesSectionTitle")}
        </p>
        <p className="hf-type-small text-text-secondary px-1">{t("frontPageSettings.zonesIntro")}</p>
        <div className="flex flex-col gap-1 overflow-hidden rounded-2xl bg-hf-tan">
          {pulse.zones.map((zone, index) => {
            const selected = pulse.selected === index;
            return (
              <div
                key={index}
                className={`hf-control-row flex items-center gap-3 px-4 ${
                  index < pulse.zones.length - 1 ? "border-b border-hf-tan-dark" : ""
                }`}
              >
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => savePulseZoneSettings({ ...pulse, selected: index })}
                  className={`hf-type-body hf-type-strong rounded-full px-3 py-1 ${
                    selected ? "hf-selected" : "bg-hf-white text-hf-black"
                  }`}
                >
                  {t("frontPageSettings.zoneLabel", { zone: index + 1 })}
                </button>
                <span className="flex-1" />
                <input
                  type="number"
                  inputMode="numeric"
                  aria-label={t("frontPageSettings.zoneMin", { zone: index + 1 })}
                  defaultValue={zone.min}
                  key={`min-${index}-${zone.min}`}
                  onBlur={(event) => setZoneBound(index, "min", event.target.value)}
                  className="hf-type-body w-16 rounded-lg bg-hf-white px-2 py-1 text-right text-hf-black"
                />
                <span className="hf-type-body text-hf-black">–</span>
                <input
                  type="number"
                  inputMode="numeric"
                  aria-label={t("frontPageSettings.zoneMax", { zone: index + 1 })}
                  defaultValue={zone.max}
                  key={`max-${index}-${zone.max}`}
                  onBlur={(event) => setZoneBound(index, "max", event.target.value)}
                  className="hf-type-body w-16 rounded-lg bg-hf-white px-2 py-1 text-right text-hf-black"
                />
                <span className="hf-type-small text-text-secondary">bpm</span>
              </div>
            );
          })}
        </div>
      </div>
    </HfScreen>
  );
}
