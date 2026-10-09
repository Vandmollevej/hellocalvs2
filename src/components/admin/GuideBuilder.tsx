"use client";

import { useRef, useState, type CSSProperties, type DragEvent, type ReactNode } from "react";
import { IconArrowDown, IconArrowUp, IconGripVertical, IconLock, IconPlus, IconTrash, IconX } from "@tabler/icons-react";
import type { Locale as AdminLocale } from "@prisma/client";
import { t as adminT, type AdminI18nKey } from "@/lib/admin-i18n";
import { translate } from "@/i18n";
import {
  GUIDE_BACKGROUNDS,
  GUIDE_IMAGE_SIZE,
  GUIDE_MAX_ELEMENTS,
  GUIDE_MAX_SCREENS,
  GUIDE_TEXT_ROLES,
  GUIDE_THEMES,
  backgroundById,
  defaultGuideConfig,
  defaultGuideTerms,
  newScreen,
  newSettingElement,
  newTextElement,
  themeById,
  type GuideBackgroundId,
  type GuideConfig,
  type GuideElement,
  type GuideKind,
  type GuideLang,
  type GuideScreen,
  type GuideTextRoleId,
  type GuideThemeId,
  type LocalizedText,
} from "@/lib/guide-builder";
import { TERMS_ANCHORS, type TermsAnchor } from "@/lib/terms-hints";
import { OverlayCloseControl } from "@/components/hf/OverlayFrameControls";
import { StartupGuideView, TooltipsView, type GuideEditorHooks } from "@/components/guide/GuideScreenView";
import { GuideOverlay } from "@/components/guide/GuideOverlay";
import { useConfirmSheet } from "@/lib/use-confirm-sheet";

// Admin → Design → Guide-builder. Venstre: byggeklodser i masonry (farvetema,
// baggrunde, fonte, elementer, skærme, valgt element). Højre: live telefon-
// preview. Træk en baggrund ind først, derefter fonte/elementer. Gemmes pr.
// type via PUT /api/admin/guide-builder.

type DragPayload =
  | { type: "background"; id: GuideBackgroundId }
  | { type: "theme"; id: GuideThemeId }
  | { type: "text"; role: GuideTextRoleId }
  | { type: "setting" }
  | { type: "move"; elementId: string };

type DropMarker = { elementId: string; after: boolean } | "end" | null;
type SaveState = "idle" | "saving" | "saved" | "error";

const DRAG_MIME = "text/plain";

async function downscaleImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    // 2× den faste referencebredde er rigeligt til telefonen.
    const maxWidth = 804;
    const scale = Math.min(1, maxWidth / img.naturalWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.82, 0.7, 0.55, 0.4]) {
      const data = canvas.toDataURL("image/jpeg", quality);
      if (data.length < 390_000) return data;
    }
    throw new Error("too large");
  } finally {
    URL.revokeObjectURL(url);
  }
}

function Card({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`mb-3 flex break-inside-avoid flex-col gap-2 rounded-md border border-hf-tan-dark bg-hf-white p-3 ${className}`}>
      <h2 className="hf-type-body hf-type-strong text-hf-black">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="hf-type-small flex flex-col gap-1 text-text-secondary">
      {label}
      {children}
    </label>
  );
}

const inputClass = "hf-type-body rounded-md border border-hf-tan-dark bg-hf-white px-2 py-1.5 text-hf-black";

export function GuideBuilder({
  locale,
  initialConfigs,
  dbUnavailable,
}: {
  locale: AdminLocale;
  initialConfigs: Record<GuideKind, GuideConfig>;
  dbUnavailable: boolean;
}) {
  const tr = (key: AdminI18nKey) => adminT(locale, key);
  const uiLang: GuideLang = locale === "EN" ? "en" : "da";
  const { ask, sheet } = useConfirmSheet();

  const [configs, setConfigs] = useState(initialConfigs);
  const [kind, setKind] = useState<GuideKind>("startup");
  const [lang, setLang] = useState<GuideLang>(uiLang);
  const [screenIndex, setScreenIndex] = useState<Record<GuideKind, number>>({ startup: 0, tooltips: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState<Record<GuideKind, boolean>>({ startup: false, tooltips: false });
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [dropMarker, setDropMarker] = useState<DropMarker>(null);
  const [dragging, setDragging] = useState<DragPayload | null>(null);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const dragRef = useRef<DragPayload | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const config = configs[kind];
  const index = Math.min(screenIndex[kind], config.screens.length - 1);
  const screen = config.screens[index];
  const selected = screen.elements.find((el) => el.id === selectedId) ?? null;
  const backgroundChosen = screen.background !== null;
  const anyDirty = dirty.startup || dirty.tooltips;

  function update(mutator: (config: GuideConfig) => GuideConfig) {
    setConfigs((prev) => ({ ...prev, [kind]: mutator(prev[kind]) }));
    setDirty((prev) => ({ ...prev, [kind]: true }));
    setSaveState("idle");
  }

  function updateScreen(mutator: (screen: GuideScreen) => GuideScreen) {
    update((c) => ({ ...c, screens: c.screens.map((s, i) => (i === index ? mutator(s) : s)) }));
  }

  function updateElement(id: string, patch: Partial<GuideElement>) {
    updateScreen((s) => ({
      ...s,
      elements: s.elements.map((el) => (el.id === id ? ({ ...el, ...patch } as GuideElement) : el)),
    }));
  }

  function selectScreen(next: number) {
    setScreenIndex((prev) => ({ ...prev, [kind]: next }));
    setSelectedId(null);
  }

  function switchKind(next: GuideKind) {
    setKind(next);
    setSelectedId(null);
  }

  // --- Drag n drop -------------------------------------------------------

  function startDrag(event: DragEvent, payload: DragPayload) {
    dragRef.current = payload;
    setDragging(payload);
    event.dataTransfer.effectAllowed = payload.type === "move" ? "move" : "copy";
    event.dataTransfer.setData(DRAG_MIME, payload.type);
  }

  function endDrag() {
    dragRef.current = null;
    setDragging(null);
    setDropMarker(null);
  }

  const isContentPayload = (p: DragPayload | null) => p?.type === "text" || p?.type === "setting" || p?.type === "move";
  const isSurfacePayload = (p: DragPayload | null) => p?.type === "background" || p?.type === "theme";

  function applyTheme(id: GuideThemeId) {
    const theme = themeById(id);
    // Et tema er et eksplicit baggrundsvalg for alle skærme.
    update((c) => ({ ...c, theme: id, screens: c.screens.map((s) => ({ ...s, background: theme.background })) }));
  }

  function applyBackground(id: GuideBackgroundId) {
    updateScreen((s) => ({ ...s, background: id }));
  }

  function insertElement(payload: DragPayload, marker: DropMarker) {
    const elements = screen.elements;
    let target = elements.length;
    if (marker && marker !== "end") {
      const at = elements.findIndex((el) => el.id === marker.elementId);
      if (at >= 0) target = at + (marker.after ? 1 : 0);
    }
    if (payload.type === "move") {
      const from = elements.findIndex((el) => el.id === payload.elementId);
      if (from < 0) return;
      const next = [...elements];
      const [moved] = next.splice(from, 1);
      next.splice(from < target ? target - 1 : target, 0, moved);
      updateScreen((s) => ({ ...s, elements: next }));
      return;
    }
    if (!backgroundChosen || elements.length >= GUIDE_MAX_ELEMENTS) return;
    if (payload.type === "setting" && kind !== "startup") return;
    const created = payload.type === "setting" ? newSettingElement() : payload.type === "text" ? newTextElement(payload.role) : null;
    if (!created) return;
    const next = [...elements];
    next.splice(target, 0, created);
    updateScreen((s) => ({ ...s, elements: next }));
    setSelectedId(created.id);
  }

  function handleDrop(event: DragEvent, marker: DropMarker) {
    const payload = dragRef.current;
    event.preventDefault();
    event.stopPropagation();
    if (payload?.type === "background") applyBackground(payload.id);
    else if (payload?.type === "theme") applyTheme(payload.id);
    else if (payload) insertElement(payload, marker);
    endDrag();
  }

  function allowDrop(event: DragEvent, marker: DropMarker) {
    const payload = dragRef.current;
    if (!payload) return;
    if (isContentPayload(payload) && payload.type !== "move" && !backgroundChosen) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = payload.type === "move" ? "move" : "copy";
    if (isContentPayload(payload)) setDropMarker(marker);
  }

  async function loadImageFile(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    setImageError(false);
    try {
      const data = await downscaleImage(file);
      updateScreen((s) => ({ ...s, image: data }));
    } catch {
      setImageError(true);
    }
  }

  const hooks: GuideEditorHooks = {
    contentProps: {
      onDragOver: (event) => allowDrop(event, "end"),
      onDrop: (event) => handleDrop(event, "end"),
      className: `relative ${dragging && isContentPayload(dragging) && backgroundChosen ? "outline-dashed outline-2 -outline-offset-4 outline-hf-green" : ""}`,
    },
    imageProps: {
      onDragOver: (event) => {
        if (event.dataTransfer.types.includes("Files")) {
          event.preventDefault();
          event.stopPropagation();
        }
      },
      onDrop: (event) => {
        if (event.dataTransfer.files.length === 0) return;
        event.preventDefault();
        event.stopPropagation();
        void loadImageFile(event.dataTransfer.files[0]);
      },
      onClick: () => fileInputRef.current?.click(),
      className: "cursor-pointer",
    },
    wrapElement: (element, _i, node) => {
      const isSelected = element.id === selectedId;
      const marker = dropMarker && dropMarker !== "end" && dropMarker.elementId === element.id ? dropMarker : null;
      return (
        <div
          draggable
          onDragStart={(event) => startDrag(event, { type: "move", elementId: element.id })}
          onDragEnd={endDrag}
          onDragOver={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            allowDrop(event, { elementId: element.id, after: event.clientY > rect.top + rect.height / 2 });
          }}
          onDrop={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            handleDrop(event, { elementId: element.id, after: event.clientY > rect.top + rect.height / 2 });
          }}
          onClick={(event) => {
            event.stopPropagation();
            setSelectedId(element.id);
          }}
          className={`relative cursor-grab rounded-md outline-offset-4 ${
            isSelected ? "outline outline-2 outline-hf-green" : "hover:outline-dashed hover:outline-1 hover:outline-text-muted"
          }`}
        >
          {marker && (
            <span
              aria-hidden="true"
              className={`absolute inset-x-0 h-[3px] rounded-full bg-hf-green ${marker.after ? "-bottom-2.5" : "-top-2.5"}`}
            />
          )}
          {isSelected && (
            <button
              type="button"
              aria-label={tr("gb_delete")}
              onClick={(event) => {
                event.stopPropagation();
                removeElement(element.id);
              }}
              className="absolute -right-3 -top-3 z-10 flex size-6 items-center justify-center rounded-full bg-hf-black text-hf-white"
            >
              <IconX size={14} />
            </button>
          )}
          {node}
        </div>
      );
    },
  };
  function removeElement(id: string) {
    updateScreen((s) => ({ ...s, elements: s.elements.filter((el) => el.id !== id) }));
    setSelectedId(null);
  }

  function addScreen() {
    if (config.screens.length >= GUIDE_MAX_SCREENS) return;
    update((c) => ({ ...c, screens: [...c.screens, newScreen(kind, c.screens.length)] }));
    setScreenIndex((prev) => ({ ...prev, [kind]: config.screens.length }));
    setSelectedId(null);
  }

  function removeScreen(at: number) {
    if (config.screens.length <= 1) return;
    update((c) => ({ ...c, screens: c.screens.filter((_, i) => i !== at) }));
    selectScreen(Math.max(0, Math.min(at, config.screens.length - 2)));
  }

  function moveScreen(at: number, delta: -1 | 1) {
    const to = at + delta;
    if (to < 0 || to >= config.screens.length) return;
    update((c) => {
      const next = [...c.screens];
      [next[at], next[to]] = [next[to], next[at]];
      return { ...c, screens: next };
    });
    selectScreen(to);
  }

  async function save() {
    setSaveState("saving");
    try {
      for (const k of (["startup", "tooltips"] as GuideKind[]).filter((k) => dirty[k])) {
        const res = await fetch("/api/admin/guide-builder", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: k, config: configs[k] }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { config: GuideConfig };
        setConfigs((prev) => ({ ...prev, [k]: data.config }));
        setDirty((prev) => ({ ...prev, [k]: false }));
      }
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  function resetToDefault() {
    ask(tr("gb_reset_confirm"), () => {
      update(() => defaultGuideConfig(kind));
      selectScreen(0);
    });
  }

  // --- Render ------------------------------------------------------------

  const tileBase = "hf-type-small flex items-center gap-2 rounded-md border border-hf-tan-dark bg-hf-white p-2 text-left text-hf-black";
  const localizedInput = (label: AdminI18nKey, value: string, onChange: (v: string) => void, multiline = false) => (
    <Field label={tr(label)}>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className={inputClass} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} />
      )}
    </Field>
  );
  const setLocalized = (text: LocalizedText, key: GuideLang, value: string): LocalizedText => ({ ...text, [key]: value });

  const previewTop = (
    <div
      className="flex shrink-0 justify-end px-4 pt-6"
      style={backgroundById(screen.background ?? themeById(config.theme).background).dark ? ({ "--hf-black": "var(--hf-color-white)" } as CSSProperties) : undefined}
    >
      <OverlayCloseControl label={translate(lang, "guide.close")} counting={false} secondsLeft={0} onClose={() => undefined} />
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {sheet}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-md border border-hf-tan-dark p-0.5" role="tablist">
          {(["startup", "tooltips"] as GuideKind[]).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={kind === k}
              onClick={() => switchKind(k)}
              className={`hf-type-body rounded px-3 py-1.5 ${kind === k ? "bg-hf-black text-hf-white" : "text-text-secondary hover:bg-hf-tan"}`}
            >
              {tr(k === "startup" ? "gb_tab_startup" : "gb_tab_tooltips")}
              {dirty[k] ? " •" : ""}
            </button>
          ))}
        </div>
        <div className="hf-type-small flex items-center gap-1 text-text-secondary">
          {tr("gb_preview_lang")}
          {(["da", "en"] as GuideLang[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              aria-pressed={lang === l}
              className={`rounded border border-hf-tan-dark px-2 py-1 uppercase ${lang === l ? "bg-hf-black text-hf-white" : "hover:bg-hf-tan"}`}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className={`hf-type-small ${saveState === "error" ? "text-hf-red-dark" : "text-text-muted"}`}>
            {saveState === "saving"
              ? tr("gb_saving")
              : saveState === "error"
                ? tr("gb_save_error")
                : saveState === "saved" && !anyDirty
                  ? tr("gb_saved")
                  : anyDirty
                    ? tr("gb_unsaved")
                    : ""}
          </span>
          <button
            type="button"
            onClick={resetToDefault}
            className="hf-type-body rounded-md border border-hf-tan-dark px-3 py-2 text-text-secondary hover:bg-hf-tan"
          >
            {tr("gb_reset_default")}
          </button>
          <button
            type="button"
            onClick={() => setOverlayOpen(true)}
            className="hf-type-body rounded-md border border-hf-tan-dark px-3 py-2 text-hf-black hover:bg-hf-tan"
          >
            {tr("gb_open_overlay")}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!anyDirty || saveState === "saving"}
            className="hf-type-body hf-type-strong rounded-md bg-hf-green-dark px-4 py-2 text-hf-white disabled:opacity-50"
          >
            {tr("gb_save")}
          </button>
        </div>
      </div>

      {dbUnavailable && <p className="hf-type-small text-hf-red-dark">{tr("gb_db_unavailable")}</p>}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_auto]">
        {/* Venstre: byggeklodser i masonry */}
        <div className="columns-1 gap-3 md:columns-2">
          <Card title={tr("gb_themes")}>
            <div className="grid grid-cols-2 gap-2">
              {GUIDE_THEMES.map((theme) => {
                const bg = backgroundById(theme.background);
                const accent = backgroundById(theme.accent);
                const active = config.theme === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    draggable
                    onDragStart={(event) => startDrag(event, { type: "theme", id: theme.id })}
                    onDragEnd={endDrag}
                    onClick={() => applyTheme(theme.id)}
                    aria-pressed={active}
                    className={`${tileBase} flex-col items-stretch ${active ? "outline outline-2 outline-hf-green" : ""}`}
                  >
                    <span className="flex h-10 items-end gap-1 rounded border border-hf-tan-dark p-1.5" style={{ background: bg.hex }}>
                      <span className="h-1 flex-1 rounded-full" style={{ background: accent.hex }} />
                      <span className="size-2 rounded-full" style={{ background: accent.hex }} />
                    </span>
                    <span>{theme.label[uiLang]}</span>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card title={tr("gb_backgrounds")}>
            <div className="grid grid-cols-2 gap-2">
              {GUIDE_BACKGROUNDS.map((bg) => (
                <button
                  key={bg.id}
                  type="button"
                  draggable
                  onDragStart={(event) => startDrag(event, { type: "background", id: bg.id })}
                  onDragEnd={endDrag}
                  onClick={() => applyBackground(bg.id)}
                  aria-pressed={screen.background === bg.id}
                  className={`${tileBase} cursor-grab ${screen.background === bg.id ? "outline outline-2 outline-hf-green" : ""}`}
                >
                  <span className="size-8 shrink-0 rounded border border-hf-tan-dark" style={{ background: bg.hex }} />
                  <span className="flex min-w-0 flex-col">
                    <span>{bg.label[uiLang]}</span>
                    <span className="text-text-muted">{bg.hex}</span>
                  </span>
                </button>
              ))}
            </div>
          </Card>

          <Card title={tr("gb_fonts")}>
            {!backgroundChosen && (
              <p className="hf-type-small flex items-center gap-1 text-text-secondary">
                <IconLock size={14} /> {tr("gb_drag_bg_first")}
              </p>
            )}
            <div className="flex flex-col gap-2">
              {GUIDE_TEXT_ROLES.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  draggable={backgroundChosen}
                  disabled={!backgroundChosen}
                  onDragStart={(event) => startDrag(event, { type: "text", role: role.id })}
                  onDragEnd={endDrag}
                  onClick={() => insertElement({ type: "text", role: role.id }, "end")}
                  className={`${tileBase} cursor-grab justify-between disabled:cursor-not-allowed disabled:opacity-40`}
                >
                  <span className={`text-left ${role.className} truncate`}>
                    {role.label[uiLang]}
                  </span>
                  <span className="shrink-0 text-text-muted">{role.sample}</span>
                </button>
              ))}
            </div>
          </Card>

          {kind === "startup" && (
            <Card title={tr("gb_blocks")}>
              <button
                type="button"
                draggable={backgroundChosen}
                disabled={!backgroundChosen}
                onDragStart={(event) => startDrag(event, { type: "setting" })}
                onDragEnd={endDrag}
                onClick={() => insertElement({ type: "setting" }, "end")}
                className={`${tileBase} cursor-grab disabled:cursor-not-allowed disabled:opacity-40`}
              >
                <IconGripVertical size={16} className="text-text-muted" />
                <span className="flex-1">{tr("gb_setting_block")}</span>
                <span className="flex overflow-hidden rounded border border-hf-black text-hf-black">
                  <span className="bg-hf-tan px-1.5">−</span>
                  <span className="border-x border-hf-black px-1.5">2</span>
                  <span className="bg-hf-tan px-1.5">+</span>
                </span>
              </button>
            </Card>
          )}

          <Card title={tr("gb_screens")}>
            <ol className="flex flex-col gap-1">
              {config.screens.map((s, i) => (
                <li key={s.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => selectScreen(i)}
                    aria-current={i === index ? "true" : undefined}
                    className={`hf-type-body flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left ${
                      i === index ? "bg-hf-black text-hf-white" : "text-hf-black hover:bg-hf-tan"
                    }`}
                  >
                    <span
                      className="size-4 shrink-0 rounded-sm border border-hf-tan-dark"
                      style={{ background: s.background ? backgroundById(s.background).hex : "transparent" }}
                    />
                    <span className="truncate">
                      {i + 1}. {s.stepLabel[uiLang] || s.stepLabel.da}
                    </span>
                  </button>
                  <button type="button" aria-label={tr("gb_move_up")} onClick={() => moveScreen(i, -1)} disabled={i === 0} className="p-1 text-text-secondary disabled:opacity-30">
                    <IconArrowUp size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label={tr("gb_move_down")}
                    onClick={() => moveScreen(i, 1)}
                    disabled={i === config.screens.length - 1}
                    className="p-1 text-text-secondary disabled:opacity-30"
                  >
                    <IconArrowDown size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label={tr("gb_remove_screen")}
                    onClick={() => removeScreen(i)}
                    disabled={config.screens.length <= 1}
                    className="p-1 text-text-secondary disabled:opacity-30"
                  >
                    <IconTrash size={16} />
                  </button>
                </li>
              ))}
            </ol>
            <button
              type="button"
              onClick={addScreen}
              disabled={config.screens.length >= GUIDE_MAX_SCREENS}
              className="hf-type-body flex items-center justify-center gap-1 rounded-md border border-dashed border-hf-tan-dark px-3 py-2 text-text-secondary hover:bg-hf-tan disabled:opacity-40"
            >
              <IconPlus size={16} /> {tr(kind === "startup" ? "gb_add_screen" : "gb_add_tooltip")}
            </button>
            <div className="mt-1 flex flex-col gap-2 border-t border-hf-tan-dark pt-2">
              <p className="hf-type-small text-text-secondary">
                {tr("gb_background")}: {screen.background ? backgroundById(screen.background).label[uiLang] : tr("gb_background_none")}
              </p>
              {localizedInput("gb_step_label_da", screen.stepLabel.da, (v) =>
                updateScreen((s) => ({ ...s, stepLabel: setLocalized(s.stepLabel, "da", v) })),
              )}
              {localizedInput("gb_step_label_en", screen.stepLabel.en, (v) =>
                updateScreen((s) => ({ ...s, stepLabel: setLocalized(s.stepLabel, "en", v) })),
              )}
              <Field label={`${tr("gb_image")} (${GUIDE_IMAGE_SIZE[kind].width} × ${GUIDE_IMAGE_SIZE[kind].height} px)`}>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="hf-type-body rounded-md border border-hf-tan-dark px-3 py-1.5 text-hf-black hover:bg-hf-tan"
                  >
                    {tr("gb_image_upload")}
                  </button>
                  {screen.image && (
                    <button
                      type="button"
                      onClick={() => updateScreen((s) => ({ ...s, image: null }))}
                      className="hf-type-body rounded-md border border-hf-tan-dark px-3 py-1.5 text-text-secondary hover:bg-hf-tan"
                    >
                      {tr("gb_image_remove")}
                    </button>
                  )}
                </div>
              </Field>
              <Field label={tr("gb_image_url")}>
                <input
                  value={screen.image && !screen.image.startsWith("data:") ? screen.image : ""}
                  onChange={(e) => updateScreen((s) => ({ ...s, image: e.target.value.trim() || null }))}
                  placeholder="https://… eller /sti/til/billede.jpg"
                  className={inputClass}
                />
              </Field>
              <p className="hf-type-small text-text-muted">{tr("gb_image_note")}</p>
              {imageError && <p className="hf-type-small text-hf-red-dark">{tr("gb_image_error")}</p>}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  void loadImageFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>
          </Card>

          {kind === "startup" && (
            <Card title={tr("gb_terms_title")}>
              {localizedInput(
                "gb_terms_da",
                screen.terms?.text.da ?? "",
                (v) => updateScreen((s) => ({ ...s, terms: { ...(s.terms ?? defaultGuideTerms()), text: setLocalized((s.terms ?? defaultGuideTerms()).text, "da", v) } })),
                true,
              )}
              {localizedInput(
                "gb_terms_en",
                screen.terms?.text.en ?? "",
                (v) => updateScreen((s) => ({ ...s, terms: { ...(s.terms ?? defaultGuideTerms()), text: setLocalized((s.terms ?? defaultGuideTerms()).text, "en", v) } })),
                true,
              )}
              <Field label={tr("gb_terms_anchor")}>
                <select
                  value={screen.terms?.anchor ?? "hvad-er-hello-cal"}
                  onChange={(e) =>
                    updateScreen((s) => ({ ...s, terms: { ...(s.terms ?? defaultGuideTerms()), anchor: e.target.value as TermsAnchor } }))
                  }
                  className={inputClass}
                >
                  {TERMS_ANCHORS.map((anchor) => (
                    <option key={anchor.id} value={anchor.id}>
                      {anchor.label}
                    </option>
                  ))}
                </select>
              </Field>
              <p className="hf-type-small text-text-muted">{tr("gb_terms_note")}</p>
            </Card>
          )}

          <Card title={tr("gb_selected")}>
            {!selected ? (
              <p className="hf-type-small text-text-secondary">{tr("gb_none_selected")}</p>
            ) : selected.type === "text" ? (
              <>
                <Field label={tr("gb_font")}>
                  <select
                    value={selected.role}
                    onChange={(e) => updateElement(selected.id, { role: e.target.value as GuideTextRoleId })}
                    className={inputClass}
                  >
                    {GUIDE_TEXT_ROLES.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.label[uiLang]} · {role.sample}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={tr("gb_align")}>
                  <div className="flex gap-2">
                    {(["left", "center"] as const).map((align) => (
                      <button
                        key={align}
                        type="button"
                        onClick={() => updateElement(selected.id, { align })}
                        aria-pressed={selected.align === align}
                        className={`hf-type-body rounded border border-hf-tan-dark px-3 py-1 ${
                          selected.align === align ? "bg-hf-black text-hf-white" : "text-hf-black hover:bg-hf-tan"
                        }`}
                      >
                        {tr(align === "left" ? "gb_align_left" : "gb_align_center")}
                      </button>
                    ))}
                  </div>
                </Field>
                {localizedInput("gb_text_da", selected.text.da, (v) => updateElement(selected.id, { text: setLocalized(selected.text, "da", v) }), true)}
                {localizedInput("gb_text_en", selected.text.en, (v) => updateElement(selected.id, { text: setLocalized(selected.text, "en", v) }), true)}
                <DeleteButton label={tr("gb_delete")} onClick={() => removeElement(selected.id)} />
              </>
            ) : (
              <>
                {localizedInput("gb_label_da", selected.label.da, (v) => updateElement(selected.id, { label: setLocalized(selected.label, "da", v) }))}
                {localizedInput("gb_label_en", selected.label.en, (v) => updateElement(selected.id, { label: setLocalized(selected.label, "en", v) }))}
                {localizedInput("gb_hint_da", selected.hint.da, (v) => updateElement(selected.id, { hint: setLocalized(selected.hint, "da", v) }))}
                {localizedInput("gb_hint_en", selected.hint.en, (v) => updateElement(selected.id, { hint: setLocalized(selected.hint, "en", v) }))}
                <div className="grid grid-cols-3 gap-2">
                  {(["value", "min", "max"] as const).map((field) => (
                    <Field key={field} label={tr(field === "value" ? "gb_value" : field === "min" ? "gb_min" : "gb_max")}>
                      <input
                        type="number"
                        value={selected[field]}
                        onChange={(e) => {
                          const n = Math.max(0, Math.min(99, Math.round(Number(e.target.value) || 0)));
                          const next = { min: selected.min, max: selected.max, value: selected.value, [field]: n };
                          if (next.max < next.min) next.max = next.min;
                          next.value = Math.min(next.max, Math.max(next.min, next.value));
                          updateElement(selected.id, next);
                        }}
                        className={inputClass}
                      />
                    </Field>
                  ))}
                </div>
                <DeleteButton label={tr("gb_delete")} onClick={() => removeElement(selected.id)} />
              </>
            )}
          </Card>
        </div>

        {/* Højre: telefon-preview */}
        <div className="flex flex-col items-center gap-2 xl:sticky xl:top-4">
          <p className="hf-type-small text-text-muted">
            {tr(kind === "startup" ? "gb_screen" : "gb_tooltip")} {index + 1} / {config.screens.length} · 402 × 820 px
          </p>
          <div
            onDragOver={(event) => {
              if (isSurfacePayload(dragRef.current)) {
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
              }
            }}
            onDrop={(event) => {
              if (isSurfacePayload(dragRef.current)) handleDrop(event, null);
            }}
            onDragLeave={() => setDropMarker(null)}
            onClick={() => setSelectedId(null)}
            className={`relative h-[820px] w-[402px] max-w-full overflow-hidden rounded-[44px] border-[10px] border-hf-black bg-hf-cream shadow-lg transition ${
              dragging && isSurfacePayload(dragging) ? "ring-4 ring-hf-green ring-offset-2" : ""
            }`}
          >
            {kind === "startup" ? (
              <StartupGuideView
                config={config}
                index={index}
                lang={lang}
                hooks={hooks}
                topSlot={previewTop}
                onBack={() => selectScreen(Math.max(0, index - 1))}
                onNext={() => selectScreen(Math.min(config.screens.length - 1, index + 1))}
                onSettingChange={(id, value) => updateElement(id, { value })}
              />
            ) : (
              <TooltipsView
                config={config}
                index={index}
                lang={lang}
                hooks={hooks}
                topSlot={previewTop}
                onIndexChange={(i) => {
                  if (i !== index) selectScreen(i);
                }}
              />
            )}
            {!backgroundChosen && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-hf-cream/80 p-8 text-center">
                <p className="hf-type-body hf-type-strong rounded-md border-2 border-dashed border-hf-green px-4 py-6 text-hf-green-dark">
                  {tr("gb_drop_bg_here")}
                </p>
              </div>
            )}
            {backgroundChosen && screen.elements.length === 0 && (
              <div className="pointer-events-none absolute inset-x-6 top-1/2 flex justify-center">
                <p className="hf-type-body hf-type-strong rounded-md border-2 border-dashed border-hf-green bg-hf-white/80 px-4 py-4 text-hf-green-dark">
                  {tr("gb_drop_fonts_here")}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {overlayOpen && (
        <GuideOverlay config={config} lang={lang} startIndex={index} onClose={() => setOverlayOpen(false)} />
      )}
    </div>
  );
}

function DeleteButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hf-type-body flex items-center justify-center gap-1 rounded-md border border-hf-tan-dark px-3 py-1.5 text-hf-red-dark hover:bg-hf-tan"
    >
      <IconTrash size={16} /> {label}
    </button>
  );
}
