"use client";

import { useState } from "react";
import { IconMicrophone, IconChevronUp, IconChevronDown, IconMinus, IconPlus } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";

type Item = {
  id: string;
  title: string;
  kcal: number;
  amountLabel: string;
  protein: number;
  carbs: number;
  fat: number;
};

const items: Item[] = [
  { id: "1", title: "Rugbrød, 2 skiver", kcal: 180, amountLabel: "2 skiver", protein: 6, carbs: 28, fat: 2 },
  { id: "2", title: "Smør, lidt", kcal: 35, amountLabel: "8 g", protein: 0, carbs: 0, fat: 4 },
  { id: "3", title: "Roastbeef, tykt lag", kcal: 90, amountLabel: "40 g", protein: 12, carbs: 0, fat: 4 },
];

function MacroBar({ label, grams, max }: { label: string; grams: number; max: number }) {
  const pct = Math.min(100, (grams / max) * 100);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[13px] text-hf-black opacity-70">{label}</span>
        <span className="min-w-[36px] text-right text-base font-bold text-hf-black">
          {grams} g
        </span>
      </div>
      <div className="relative flex h-5 items-center">
        <div className="relative h-1 w-full rounded bg-hf-tan-dark">
          <div
            className="absolute inset-y-0 left-0 rounded bg-hf-green"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div
          className="absolute h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-hf-green bg-hf-white"
          style={{ left: `${pct}%`, top: "50%" }}
        />
      </div>
    </div>
  );
}

function VoiceItem({ item, open, onToggle }: { item: Item; open: boolean; onToggle: () => void }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-hf-tan">
      <div className="flex items-center gap-2.5 px-4 py-3.5">
        <div className="h-11 w-11 flex-shrink-0 rounded-full bg-hf-white" />
        <p className="flex-1 text-[15px] font-bold text-hf-black">{item.title}</p>
        <span className="text-sm text-hf-black opacity-70">{item.kcal} kcal</span>
      </div>

      <button
        onClick={onToggle}
        aria-label={open ? "Fold sammen" : "Fold ud"}
        className="flex w-full justify-center border-y border-hf-tan-dark py-1"
      >
        {open ? (
          <IconChevronUp size={15} color="var(--hf-black)" />
        ) : (
          <IconChevronDown size={15} color="var(--hf-black)" />
        )}
      </button>

      {open && (
        <div className="flex flex-col gap-4 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-hf-black opacity-70">Mængde</span>
            <div className="flex items-center gap-2.5">
              <button className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-hf-white">
                <IconMinus size={13} color="var(--hf-black)" />
              </button>
              <span className="min-w-[52px] text-center text-[15px] font-medium text-hf-black">
                {item.amountLabel}
              </span>
              <button className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-hf-white">
                <IconPlus size={13} color="var(--hf-black)" />
              </button>
            </div>
          </div>

          <div>
            <p className="mb-4 text-[15px] font-extrabold text-hf-black">Energifordeling</p>
            <div className="flex flex-col gap-5">
              <MacroBar label="Protein" grams={item.protein} max={30} />
              <MacroBar label="Kulhydrat" grams={item.carbs} max={40} />
              <MacroBar label="Fedt" grams={item.fat} max={20} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StemmePage() {
  const [openId, setOpenId] = useState<string | null>(null);
  const [transcript] = useState(
    "...to skiver rugbrød med lidt smør og et tykt lag roastbeef, og et glas mælk"
  );

  return (
    <HfScreen title="Lytter...">
      <div className="flex flex-col gap-3 p-4">
        {items.map((item) => (
          <VoiceItem
            key={item.id}
            item={item}
            open={openId === item.id}
            onToggle={() => setOpenId((v) => (v === item.id ? null : item.id))}
          />
        ))}

        <div className="flex items-center gap-2.5 rounded-2xl bg-hf-tan p-3.5">
          <IconMicrophone size={16} color="var(--hf-black)" />
          <p className="flex-1 text-sm text-hf-black opacity-80">&quot;{transcript}&quot;</p>
        </div>

        <p className="text-center text-[11px] text-hf-black opacity-50">
          Forberedt til rigtig taleoptagelse (mikrofon + tale-til-tekst) —
          kræver en mobil med mikrofonadgang for at fungere fuldt ud.
        </p>
      </div>
    </HfScreen>
  );
}
