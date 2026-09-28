"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { IconArrowLeft, IconSearch } from "@tabler/icons-react";
import type { AdditiveInfo } from "@/lib/additives";
import { alternativeSources, eNumberAnchor, researchLinks, type ExternalLink } from "@/lib/e-number-links";

function numericPart(code: string) {
  return Number.parseInt(code.replace(/\D/g, ""), 10) || 0;
}

export function ENumberDirectory({ additives }: { additives: AdditiveInfo[] }) {
  const [query, setQuery] = useState("");
  const [activeAnchor, setActiveAnchor] = useState("");

  const sorted = useMemo(
    () =>
      [...additives].sort(
        (a, b) => numericPart(a.eNumber) - numericPart(b.eNumber) || a.eNumber.localeCompare(b.eNumber),
      ),
    [additives],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    const compact = q.replace(/[^a-z0-9]/g, "");
    return sorted.filter(
      (item) =>
        (compact && eNumberAnchor(item.eNumber).includes(compact)) ||
        [item.internationalName, item.danishName, item.function].some((text) => text.toLowerCase().includes(q)),
    );
  }, [query, sorted]);

  // Fremhæv og scroll til det E-nummer, der er linket til (#e330).
  useEffect(() => {
    const sync = () => {
      const anchor = decodeURIComponent(window.location.hash.slice(1));
      setActiveAnchor(anchor);
      if (anchor) {
        setQuery("");
        requestAnimationFrame(() => document.getElementById(anchor)?.scrollIntoView({ block: "start" }));
      }
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  return (
    <div className="min-h-dvh bg-hf-white text-hf-black">
      <div className="sticky top-0 z-10 border-b border-hf-tan-dark bg-hf-white px-4 pb-3 pt-4">
        <div className="mx-auto flex max-w-xl flex-col gap-3">
          <div className="flex items-center gap-2">
            <Link href="/" aria-label="Tilbage" className="flex h-8 w-8 items-center justify-center rounded-full">
              <IconArrowLeft size={20} />
            </Link>
            <h1 className="hf-type-title hf-heading">E-numre</h1>
          </div>
          <label className="flex items-center gap-2 rounded-full bg-hf-tan px-4 py-2">
            <IconSearch size={18} className="text-text-secondary" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Søg på E-nummer, navn eller funktion"
              className="hf-type-body w-full bg-transparent outline-none"
            />
          </label>
        </div>
      </div>

      <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-4">
        {visible.length === 0 && (
          <p className="hf-type-body text-text-secondary">Ingen E-numre matcher din søgning.</p>
        )}
        {visible.map((item) => {
          const anchor = eNumberAnchor(item.eNumber);
          const name = item.internationalName;
          return (
            <section
              key={item.eNumber}
              id={anchor}
              className={`scroll-mt-32 rounded-2xl border p-4 ${
                activeAnchor === anchor ? "border-hf-green" : "border-hf-black/10"
              }`}
            >
              <h2 className="hf-type-body hf-heading">
                <a href={`#${anchor}`} className="hover:underline">
                  {item.eNumber.toUpperCase()}
                  {name ? ` · ${name}` : ""}
                </a>
              </h2>
              {item.danishName && <p className="hf-type-small text-text-secondary">{item.danishName}</p>}
              <div className="mt-3 flex flex-col gap-3">
                <Field label="Forklaring" text={item.function} />
                <Field label="Sundhed og anvendelse" text={item.risks} />
                <Field label="Forskning" text={item.research} />
                <Links
                  label="Links til forskning"
                  links={[
                    ...(item.link ? [{ label: item.source || "Kilde", href: item.link }] : []),
                    ...researchLinks(item.eNumber, name),
                  ]}
                />
                <Links label="Andre troværdige kilder" links={alternativeSources(item.eNumber, name)} />
              </div>
            </section>
          );
        })}
        <p className="hf-type-small text-text-secondary">
          Generel baggrundsinformation baseret på EFSA/EU-kilder — ikke personlig kostrådgivning.
        </p>
      </div>
    </div>
  );
}

function Field({ label, text }: { label: string; text: string }) {
  if (!text) return null;
  return (
    <div>
      <p className="hf-type-small hf-heading uppercase text-text-secondary">{label}</p>
      <p className="hf-type-body">{text}</p>
    </div>
  );
}

function Links({ label, links }: { label: string; links: ExternalLink[] }) {
  return (
    <div>
      <p className="hf-type-small hf-heading uppercase text-text-secondary">{label}</p>
      <ul className="flex flex-wrap gap-x-3 gap-y-1">
        {links.map((link) => (
          <li key={link.href}>
            <a
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className="hf-type-small text-hf-green underline underline-offset-2"
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
