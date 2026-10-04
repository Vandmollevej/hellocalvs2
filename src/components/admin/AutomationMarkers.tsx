"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { pageSlug, slugifyAutomation, uniqueName } from "@/lib/automation-markers";

// Giver alle knapper, links, felter og faner i admin et fast `id` og
// `data-automation`, hvis de ikke har et (docs/AUTOMATION.md). Skallens egne
// menuer er mærket i hånden og springes over. Navnet kommer fra feltets
// navn/label/tekst, så det følger sproget (DA/EN) og er derfor "best effort";
// gentagelser på samme side får -2, -3 i DOM-rækkefølge.
const SELECTOR = [
  "a[href]",
  "button",
  "input:not([type='hidden'])",
  "select",
  "textarea",
  "summary",
  "[role='button']",
  "[role='tab']",
  "[role='menuitem']",
  "[role='switch']",
  "[role='checkbox']",
].join(",");

function kindOf(element: Element) {
  const tag = element.tagName.toLowerCase();
  if (tag === "input") {
    const type = (element as HTMLInputElement).type;
    return type === "checkbox" || type === "radio" ? type : "input";
  }
  if (tag === "a") return "link";
  if (tag === "summary") return "toggle";
  return element.getAttribute("role") ?? tag;
}

function textOf(element: Element, max = 80) {
  return (element.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function nameOf(element: Element) {
  const field = element as HTMLInputElement;
  const labelled = element.getAttribute("aria-label");
  if (labelled) return labelled;
  if ("labels" in field && field.labels && field.labels.length > 0) return textOf(field.labels[0]);
  const parts = [
    field.name,
    element.getAttribute("placeholder"),
    textOf(element),
    element.getAttribute("title"),
    element.querySelector("img[alt]")?.getAttribute("alt"),
    element.tagName === "A" ? element.getAttribute("href")?.split("?")[0].split("/").filter(Boolean).pop() : null,
  ];
  return parts.find((part) => part && part.trim()) ?? "";
}

function annotate(root: Element, pathname: string) {
  const page = pageSlug(pathname);
  const used = new Set<string>();
  for (const marked of root.querySelectorAll("[data-automation]")) {
    used.add(marked.getAttribute("data-automation") ?? "");
  }
  for (const element of root.querySelectorAll(SELECTOR)) {
    if (element.hasAttribute("data-automation")) continue;
    const base = `${kindOf(element)}-${slugifyAutomation(nameOf(element)) || "unnamed"}`;
    const name = uniqueName(base, used);
    element.setAttribute("data-automation", name);
    if (!element.id) {
      const id = `hc-${page}--${name}`;
      if (!document.getElementById(id)) element.id = id;
    }
  }
}

export function AutomationMarkers() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.querySelector(".hf-shell");
    if (!root) return;
    let frame = 0;
    const run = () => {
      frame = 0;
      annotate(root, pathname);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(run);
    };
    // Kun tilføjede/fjernede elementer; attributter observeres ikke, så
    // mærkningen udløser ikke sig selv.
    const observer = new MutationObserver(schedule);
    observer.observe(root, { childList: true, subtree: true });
    schedule();
    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [pathname]);

  return null;
}
