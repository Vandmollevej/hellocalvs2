"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { IconArrowLeft, IconSearch } from "@tabler/icons-react";
import {
  MICRONUTRIENT_INFO,
  micronutrientAnchor,
  micronutrientSources,
  type MicronutrientInfo,
} from "@/lib/micronutrient-info";

export function MicronutrientDirectory() {
  const [query, setQuery] = useState("");
  const [activeAnchor, setActiveAnchor] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return MICRONUTRIENT_INFO;
    return MICRONUTRIENT_INFO.filter((item) =>
      [item.name, item.alsoKnownAs, item.function, item.sources].some((text) => text.toLowerCase().includes(q)),
    );
  }, [query]);

  // Fremhæv og scroll til det næringsstof, der er linket til (#vitaminc).
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

  const groups: { title: string; items: MicronutrientInfo[] }[] = [
    { title: "Vitaminer", items: visible.filter((item) => item.group === "vitamin") },
    { title: "Mineraler", items: visible.filter((item) => item.group === "mineral") },
  ];

  return (
    <div className="min-h-dvh bg-hf-white text-hf-black">
      <div className="sticky top-0 z-10 border-b border-hf-tan-dark bg-hf-white px-4 pb-3 pt-4">
        <div className="mx-auto flex max-w-xl flex-col gap-3">
          <div className="flex items-center gap-2">
            <Link href="/" aria-label="Tilbage" className="flex h-8 w-8 items-center justify-center rounded-full">
              <IconArrowLeft size={20} />
            </Link>
            <h1 className="hf-type-title hf-heading">Vitaminer og mineraler</h1>
          </div>
          <label className="flex items-center gap-2 rounded-full bg-hf-tan px-4 py-2">
            <IconSearch size={18} className="text-text-secondary" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Søg på vitamin, mineral eller funktion"
              className="hf-type-body w-full bg-transparent outline-none"
            />
          </label>
        </div>
      </div>

      <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-4">
        {visible.length === 0 && (
          <p className="hf-type-body text-text-secondary">Ingen vitaminer eller mineraler matcher din søgning.</p>
        )}
        {groups.map(
          (group) =>
            group.items.length > 0 && (
              <div key={group.title} className="flex flex-col gap-4">
                <h2 className="hf-type-title hf-heading">{group.title}</h2>
                {group.items.map((item) => {
                  const anchor = micronutrientAnchor(item.key);
                  return (
                    <section
                      key={item.key}
                      id={anchor}
                      className={`scroll-mt-32 rounded-2xl border p-4 ${
                        activeAnchor === anchor ? "border-hf-green" : "border-hf-black/10"
                      }`}
                    >
                      <h3 className="hf-type-body hf-heading">
                        <a href={`#${anchor}`} className="hover:underline">
                          {item.name}
                        </a>
                      </h3>
                      <p className="hf-type-small text-text-secondary">{item.alsoKnownAs}</p>
                      <div className="mt-3 flex flex-col gap-3">
                        <MicronutrientFields info={item} />
                      </div>
                    </section>
                  );
                })}
              </div>
            ),
        )}
        <p className="hf-type-small text-text-secondary">
          Generel baggrundsinformation. Referenceindtag er EU&apos;s referenceindtag for voksne (samme tal som
          &quot;% RI&quot; på varedeklarationer) — ikke personlig kostrådgivning.
        </p>
      </div>
    </div>
  );
}

export function MicronutrientFields({ info }: { info: MicronutrientInfo }) {
  return (
    <>
      <Field label="Funktion" text={info.function} />
      <Field label="Findes i" text={info.sources} />
      <Field label="Referenceindtag" text={info.referenceIntake} />
      <Field label="For lidt eller for meget" text={info.tooLittleOrMuch} />
      <div>
        <p className="hf-type-small hf-heading uppercase text-text-secondary">Troværdige kilder</p>
        <ul className="flex flex-wrap gap-x-3 gap-y-1">
          {micronutrientSources(info).map((link) => (
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
    </>
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
