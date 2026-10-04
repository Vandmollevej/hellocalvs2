"use client";

import Link from "next/link";
import type { Locale } from "@prisma/client";
import { t, type AdminI18nKey } from "@/lib/admin-i18n";
import { ahkSend, ariaKeyShortcuts, formatCombo, shortcutsForHref } from "@/lib/admin-shortcuts";
import { automationProps, navSlug } from "@/lib/automation-markers";
import { NAV } from "@/components/admin/AdminShell";

// Genveje-siden: alle menupunkter med deres tastaturgenvej og den tilsvarende
// AutoHotkey Send-tekst. Menuen læses direkte fra AdminShell, så nye sider
// dukker op her af sig selv ("–" hvis de endnu mangler en genvej).
type Row = { href: string; slug: string; label: string; combos: readonly string[] };
type Section = { id: string; title: string; rows: Row[] };

function buildSections(locale: Locale, canManageAdmins: boolean): Section[] {
  const row = (href: string, key: AdminI18nKey): Row => ({
    href,
    slug: navSlug(key),
    label: t(locale, key),
    combos: shortcutsForHref(href),
  });
  const sections: Section[] = [];
  const top: Row[] = [];
  for (const entry of NAV) {
    if (entry.kind === "link") top.push(row(entry.href, entry.key));
    else sections.push({ id: entry.id, title: t(locale, entry.key), rows: entry.links.map((link) => row(link.href, link.key)) });
  }
  sections.unshift({ id: "main", title: "Hovedsider", rows: top });
  if (canManageAdmins) {
    sections.push({ id: "user-menu", title: "Brugermenuen", rows: [row("/admin/admin-users", "nav_admin_users")] });
  }
  return sections;
}

function Combos({ combos }: { combos: readonly string[] }) {
  if (combos.length === 0) return <span className="text-text-muted">–</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {combos.map((combo) => (
        <kbd key={combo} className="hf-kbd">
          {formatCombo(combo)}
        </kbd>
      ))}
    </span>
  );
}

const ACTIONS: { id: string; label: string; combos: readonly string[] }[] = [
  { id: "quick-search", label: "Gå til… (søg i alle sider)", combos: ["Ctrl+K"] },
  { id: "toggle-sidebar", label: "Skjul/vis sidebjælken", combos: ["Ctrl+B"] },
];

export function ShortcutsList({ locale, canManageAdmins }: { locale: Locale; canManageAdmins: boolean }) {
  const sections = buildSections(locale, canManageAdmins);
  return (
    <div className="flex flex-col gap-6" {...automationProps("hc-shortcuts")}>
      <div>
        <h1 className="hf-type-title text-hf-black">{t(locale, "nav_shortcuts")}</h1>
        <p className="hf-type-body text-text-secondary">
          Tryk genvejen fra en vilkårlig side i admin — også mens du står i et felt. Alt + bogstav er de hyppigste
          sider, Alt + Shift + bogstav de øvrige, og Alt + 1…6 er Partnere og Roadmap i menuens rækkefølge. Ctrl + P
          åbner Varer. Genvejene rører aldrig Ctrl + A/C/V/X/Z, og AltGr (@, €) virker som normalt.
        </p>
        <p className="hf-type-small mt-1 text-text-muted">
          Kolonnen AutoHotkey er teksten til <code>Send</code>, fx <code>Send &quot;!o&quot;</code> (^ = Ctrl, ! = Alt, + = Shift).
          Genvejene står i src/lib/admin-shortcuts.ts.
        </p>
      </div>

      <section className="flex flex-col gap-2" {...automationProps("hc-shortcuts-actions")}>
        <h2 className="hf-type-body hf-type-strong">Handlinger</h2>
        <div className="hf-surface overflow-x-auto px-4">
          <table className="hf-type-body w-full min-w-[420px] text-left">
            <tbody>
              {ACTIONS.map((action) => (
                <tr key={action.id} className="border-b border-hf-tan-dark last:border-b-0">
                  <td className="py-2 pr-4">{action.label}</td>
                  <td className="py-2 pr-4">
                    <span {...automationProps(`hc-shortcut-${action.id}`)} aria-keyshortcuts={ariaKeyShortcuts(action.combos)}>
                      <Combos combos={action.combos} />
                    </span>
                  </td>
                  <td className="py-2">
                    <code className="hf-type-small">{ahkSend(action.combos[0])}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {sections.map((section) => (
        <section key={section.id} className="flex flex-col gap-2" {...automationProps(`hc-shortcuts-${section.id}`)}>
          <h2 className="hf-type-body hf-type-strong">{section.title}</h2>
          <div className="hf-surface overflow-x-auto px-4">
            <table className="hf-type-body w-full min-w-[420px] text-left">
              <thead>
                <tr className="hf-type-small border-b border-hf-tan-dark uppercase tracking-wide text-text-muted">
                  <th className="py-2 pr-4">Menupunkt</th>
                  <th className="py-2 pr-4">Genvej</th>
                  <th className="py-2">AutoHotkey</th>
                </tr>
              </thead>
              <tbody>
                {section.rows.map((item) => (
                  <tr key={item.href} className="border-b border-hf-tan-dark last:border-b-0">
                    <td className="py-2 pr-4">
                      <Link
                        href={item.href}
                        aria-keyshortcuts={ariaKeyShortcuts(item.combos)}
                        {...automationProps(`hc-shortcut-${item.slug}`)}
                        className="text-hf-black hover:underline"
                      >
                        {item.label}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">
                      <Combos combos={item.combos} />
                    </td>
                    <td className="py-2">
                      {item.combos.length > 0 ? (
                        <code className="hf-type-small">{item.combos.map(ahkSend).join("  ")}</code>
                      ) : (
                        <span className="text-text-muted">–</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
