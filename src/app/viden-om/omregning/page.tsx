"use client";

import { useState } from "react";
import { IconScale } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { AccordionCard } from "@/components/hf/AccordionCard";
import { SearchField } from "@/components/knowledge/SearchField";
import { KITCHEN_CONVERSION_GROUPS, KITCHEN_CONVERSIONS } from "@/lib/kitchen-conversions";
import { VOLUME_UNIT_ML, formatKitchenNumber } from "@/lib/kitchen-conversion-units";

// Viden om mad → Omregning (brugerens krav 2026-10-10): alle væsker i
// databasen (Frida-grupperne) plus tørvarer, der måles i dl, omregnet til gram.
// Øverst vælges en mængde (fx 2 dl eller 1 spsk); hver række viser vægten.
const UNITS = ["dl", "spsk", "tsk", "ml"] as const;

function grams(gramsPerDl: number, ml: number) {
  return `${formatKitchenNumber(Math.round((gramsPerDl * ml) / 10) / 10)} g`;
}

export default function KitchenConversionsPage() {
  const [query, setQuery] = useState("");
  const [amountText, setAmountText] = useState("1");
  const [unit, setUnit] = useState<(typeof UNITS)[number]>("dl");
  const amount = Number(amountText.replace(",", "."));
  const ml = (Number.isFinite(amount) && amount > 0 ? amount : 0) * VOLUME_UNIT_ML[unit];
  const q = query.trim().toLowerCase();
  const groups = KITCHEN_CONVERSION_GROUPS.map((group) => ({
    ...group,
    items: KITCHEN_CONVERSIONS.filter(
      (item) =>
        item.group === group.id &&
        (!q || item.name.toLowerCase().includes(q) || item.keywords.some((keyword) => keyword.includes(q))),
    ),
  })).filter((group) => group.items.length > 0);

  return (
    <HfScreen title="Omregning: væsker til gram" icon={<IconScale size={20} stroke={2} />} alwaysShowBackButton>
      <div className="hf-page flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            inputMode="decimal"
            aria-label="Mængde"
            value={amountText}
            onChange={(event) => setAmountText(event.target.value)}
            className="hf-type-body h-10 w-16 rounded-full bg-hf-tan px-3 text-center text-hf-black outline-none"
          />
          {UNITS.map((option) => (
            <button
              key={option}
              type="button"
              className="hf-choice flex-1"
              aria-pressed={unit === option}
              onClick={() => setUnit(option)}
            >
              {option}
            </button>
          ))}
        </div>
        <SearchField value={query} onChange={setQuery} placeholder="Søg fx mælk, olie, honning eller mel" />
        {groups.length === 0 && <p className="hf-type-body text-text-secondary">Ingen resultater.</p>}
        {groups.map((group) => (
          <div key={group.id}>
            <p className="hf-type-small hf-type-strong mb-2 text-hf-black">{group.title}</p>
            <AccordionCard>
              {group.items.map((item, index) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 px-4 py-3 ${
                    index < group.items.length - 1 ? "border-b border-hf-tan-dark" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="hf-type-body text-hf-black">{item.name}</p>
                    <p className="hf-type-small text-text-secondary">
                      {`1 dl = ${grams(item.gramsPerDl, 100)} · 1 spsk = ${grams(item.gramsPerDl, 15)} · 1 tsk = ${grams(item.gramsPerDl, 5)}`}
                    </p>
                  </div>
                  <p className="hf-type-body hf-type-strong flex-shrink-0 text-hf-black">{grams(item.gramsPerDl, ml)}</p>
                </div>
              ))}
            </AccordionCard>
          </div>
        ))}
      </div>
    </HfScreen>
  );
}
