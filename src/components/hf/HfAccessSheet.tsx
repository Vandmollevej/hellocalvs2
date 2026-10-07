"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { IconApple, IconBed, IconFlame, IconHeart, IconMan, IconX } from "@tabler/icons-react";
import styles from "./HfAccessSheet.module.css";

// iOS-adgangsarket, som Apple Health viser ved tilkobling
// (docs/DECISIONS.md 2026-09-27). Bruges af hver integrations egen side og
// vises live i admin → Designmanual → Integrationer.

// Health-appens kategorier med dens egne farver.
export type AccessCategory = "nutrition" | "activity" | "body" | "heart" | "sleep";

const CATEGORY_ICONS: Record<AccessCategory, { icon: typeof IconApple; color: string }> = {
  nutrition: { icon: IconApple, color: "#34c759" },
  activity: { icon: IconFlame, color: "#ff9500" },
  body: { icon: IconMan, color: "#af52de" },
  heart: { icon: IconHeart, color: "#ff2d55" },
  sleep: { icon: IconBed, color: "#30b0c7" },
};

export function AccessCategoryIcon({ category }: { category: AccessCategory }) {
  const { icon: Icon, color } = CATEGORY_ICONS[category];
  return <Icon size={22} stroke={1.8} color={color} aria-hidden="true" />;
}

export type AccessToggleRow = {
  key: string;
  label: string;
  category: AccessCategory;
  checked: boolean;
  onChange: (value: boolean) => void;
};

export function AccessSwitch({
  checked,
  onChange,
  ariaLabel,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  ariaLabel: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={styles.switch}
    >
      <span className={styles.knob} />
    </button>
  );
}

export function AccessGroup({ title, footer, children }: { title?: string; footer?: ReactNode; children: ReactNode }) {
  return (
    <>
      {title && <p className={styles.groupTitle}>{title}</p>}
      <div className={styles.group}>{children}</div>
      {footer}
    </>
  );
}

export function AccessToggleGroup({ title, rows }: { title: string; rows: AccessToggleRow[] }) {
  return (
    <AccessGroup title={title}>
      {rows.map((row) => (
        <div key={row.key} className={styles.row}>
          <span className={styles.rowIcon}>
            <AccessCategoryIcon category={row.category} />
          </span>
          <span className={styles.rowLabel}>{row.label}</span>
          <AccessSwitch checked={row.checked} onChange={row.onChange} ariaLabel={row.label} />
        </div>
      ))}
    </AccessGroup>
  );
}

// Tekstrække i en gruppe: blå handling, rød handling eller grå info.
export function AccessRow({
  children,
  tone = "info",
  onClick,
  disabled,
  trailing,
  id,
}: {
  id?: string;
  children: ReactNode;
  tone?: "action" | "danger" | "info";
  onClick?: () => void;
  disabled?: boolean;
  trailing?: ReactNode;
}) {
  if (onClick) {
    return (
      <button
        id={id}
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`${styles.row} ${styles.rowLabel} ${styles.rowAction} ${tone === "danger" ? styles.rowDanger : ""}`}
      >
        {children}
      </button>
    );
  }
  return (
    <div id={id} className={styles.row}>
      <span className={`${styles.rowLabel} ${styles.rowMuted}`}>{children}</span>
      {trailing}
    </div>
  );
}

// Blå eller rød tekstknap i højre side af en række.
export function AccessTrailingButton({
  children,
  tone = "action",
  onClick,
  disabled,
}: {
  children: ReactNode;
  tone?: "action" | "danger";
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${styles.trailing} ${tone === "danger" ? styles.rowDanger : ""}`}
    >
      {children}
    </button>
  );
}

export function AccessFooter({ children, error }: { children: ReactNode; error?: boolean }) {
  return <p className={`${styles.footer} ${error ? styles.footerError : ""}`}>{children}</p>;
}

export function AccessMono({ children }: { children: ReactNode }) {
  return <span className={styles.mono}>{children}</span>;
}

// Træk ned for at lukke (design.md §6.13): hurtigt swipe eller > 30 % af
// arkets højde lukker, ellers glider det tilbage. Indholdet kan kun trækkes,
// når det er scrollet helt op.
const START_DRAG_PX = 8;
const CLOSE_FRACTION = 0.3;
const CLOSE_VELOCITY_PX_PER_MS = 0.6;

function useSwipeToDismiss(onDismiss: (() => void) | undefined, disabled: boolean) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dismissRef = useRef(onDismiss);

  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet || disabled) return;
    let drag: { startY: number; lastY: number; lastT: number; velocity: number; active: boolean; atTop: boolean } | null = null;
    let current = 0;

    const onStart = (event: TouchEvent) => {
      const y = event.touches[0].clientY;
      drag = { startY: y, lastY: y, lastT: performance.now(), velocity: 0, active: false, atTop: (scrollRef.current?.scrollTop ?? 0) <= 0 };
    };
    const onMove = (event: TouchEvent) => {
      if (!drag) return;
      const y = event.touches[0].clientY;
      const dy = y - drag.startY;
      if (!drag.active) {
        if (dy > START_DRAG_PX && drag.atTop) {
          drag.active = true;
          drag.startY = y;
          setDragging(true);
        } else if (Math.abs(dy) > START_DRAG_PX) {
          drag = null;
          return;
        } else {
          return;
        }
      }
      if (event.cancelable) event.preventDefault();
      const now = performance.now();
      if (now > drag.lastT) drag.velocity = (y - drag.lastY) / (now - drag.lastT);
      drag.lastY = y;
      drag.lastT = now;
      current = Math.max(0, y - drag.startY);
      setOffset(current);
    };
    const onEnd = () => {
      const active = drag?.active;
      const flicked = (drag?.velocity ?? 0) > CLOSE_VELOCITY_PX_PER_MS && current > START_DRAG_PX;
      drag = null;
      if (!active) return;
      setDragging(false);
      if (flicked || current > sheet.offsetHeight * CLOSE_FRACTION) {
        setOffset(sheet.offsetHeight);
        dismissRef.current?.();
      } else {
        current = 0;
        setOffset(0);
      }
    };

    sheet.addEventListener("touchstart", onStart, { passive: true });
    sheet.addEventListener("touchmove", onMove, { passive: false });
    sheet.addEventListener("touchend", onEnd);
    sheet.addEventListener("touchcancel", onEnd);
    return () => {
      sheet.removeEventListener("touchstart", onStart);
      sheet.removeEventListener("touchmove", onMove);
      sheet.removeEventListener("touchend", onEnd);
      sheet.removeEventListener("touchcancel", onEnd);
    };
  }, [disabled]);

  return { sheetRef, scrollRef, offset, dragging };
}

export function HfAccessSheet({
  title,
  icon,
  heading,
  message,
  toggleAllLabel,
  onToggleAll,
  children,
  allowLabel,
  denyLabel,
  allowDisabled,
  denyDisabled,
  onAllow,
  onDeny,
  onDismiss,
  terms,
  closeLabel = "Luk",
  embedded = false,
}: {
  title: string;
  icon?: ReactNode;
  heading?: string;
  message: string;
  toggleAllLabel?: string;
  onToggleAll?: () => void;
  children?: ReactNode;
  allowLabel: string;
  denyLabel: string;
  allowDisabled?: boolean;
  denyDisabled?: boolean;
  onAllow: () => void;
  onDeny: () => void;
  onDismiss?: () => void;
  // "Vilkår og betingelser"-bjælken over knapperne (docs/DECISIONS.md 2026-09-27).
  terms?: ReactNode;
  // Luk-knappen øverst til højre (design.md: højre side er luk).
  closeLabel?: string;
  // Vist inde i en ramme (designmanualen) i stedet for over hele skærmen.
  embedded?: boolean;
}) {
  const { sheetRef, scrollRef, offset, dragging } = useSwipeToDismiss(onDismiss, embedded || !onDismiss);

  return (
    <div className={`${styles.backdrop} ${embedded ? styles.embedded : ""}`}>
      <div className={styles.frame}>
        {onDismiss && <div className={styles.dismissArea} onClick={onDismiss} aria-hidden="true" />}
        <div className={styles.peek} aria-hidden="true" />
        <div
          ref={sheetRef}
          className={`${styles.sheet} ${dragging ? styles.dragging : ""}`}
          style={offset ? { transform: `translateY(${offset}px)` } : undefined}
          role="dialog"
          aria-modal={!embedded}
          aria-label={title}
        >
          <div className={styles.grabber} aria-hidden="true" />
          <h1 className={styles.titleBar}>{title}</h1>
          {onDismiss && (
            <button type="button" onClick={onDismiss} className={styles.close} aria-label={closeLabel}>
              <IconX size={20} stroke={2.4} aria-hidden="true" />
            </button>
          )}
          <div ref={scrollRef} className={styles.scroll}>
            {icon && <div className={styles.appIcon}>{icon}</div>}
            {heading && <h2 className={styles.heading}>{heading}</h2>}
            <p className={styles.message}>{message}</p>
            {toggleAllLabel && onToggleAll && (
              <button type="button" onClick={onToggleAll} className={styles.pill}>
                {toggleAllLabel}
              </button>
            )}
            {children}
          </div>
          <div className={styles.actions}>
            {terms}
            <button type="button" disabled={allowDisabled} onClick={onAllow} className={`${styles.button} ${styles.allow}`}>
              {allowLabel}
            </button>
            <button type="button" disabled={denyDisabled} onClick={onDeny} className={`${styles.button} ${styles.deny}`}>
              {denyLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
