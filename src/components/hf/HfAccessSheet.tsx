"use client";

import type { ReactNode } from "react";
import { IconApple, IconBed, IconFlame, IconHeart, IconMan } from "@tabler/icons-react";
import styles from "./HfAccessSheet.module.css";

// iOS-adgangsarket, som Apple Health viser ved tilkobling
// (docs/DECISIONS.md 2026-09-27). Bruges af hver integrations egen side og
// vises live i admin → Designmanual → Adgangsark.

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
  // Vist inde i en ramme (designmanualen) i stedet for over hele skærmen.
  embedded?: boolean;
}) {
  return (
    <div className={`${styles.backdrop} ${embedded ? styles.embedded : ""}`}>
      <div className={styles.frame}>
        {onDismiss && <div className={styles.dismissArea} onClick={onDismiss} aria-hidden="true" />}
        <div className={styles.peek} aria-hidden="true" />
        <div className={styles.sheet} role="dialog" aria-modal={!embedded} aria-label={title}>
          <h1 className={styles.titleBar}>{title}</h1>
          <div className={styles.scroll}>
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
