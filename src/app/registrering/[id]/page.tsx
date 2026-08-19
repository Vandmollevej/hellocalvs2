"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";

type Entry = {
  id: string;
  title: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  ingredients: string[];
};

// Samme eksempeldata som forsidens liste (src/components/DailyList.tsx).
// Bliver reelle databaseopslag, når registreringer gemmes i Postgres.
const entries: Record<string, Entry> = {
  "1": {
    id: "1",
    title: "Kyllingesalat med avocado, ristede kerner og citronvinaigrette",
    kcal: 480,
    protein: 32,
    carbs: 18,
    fat: 26,
    ingredients: ["Kyllingebryst, 120 g", "Avocado, 1/2 stk", "Ristede kerner, 15 g", "Citronvinaigrette, 1 spsk"],
  },
  "2": {
    id: "2",
    title: "Rugbrød med skinke, tomat og lidt smør",
    kcal: 310,
    protein: 14,
    carbs: 32,
    fat: 10,
    ingredients: ["Rugbrød, 2 skiver", "Skinke, 40 g", "Tomat, 1/2 stk", "Smør, lidt"],
  },
  "3": {
    id: "3",
    title: "Havregrød med blåbær og honning",
    kcal: 450,
    protein: 12,
    carbs: 70,
    fat: 9,
    ingredients: ["Havregryn, 60 g", "Blåbær, 50 g", "Honning, 1 spsk", "Mælk, 2 dl"],
  },
};

function MacroBar({ label, grams, max }: { label: string; grams: number; max: number }) {
  const pct = Math.min(100, (grams / max) * 100);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[13px] text-hf-black opacity-70">{label}</span>
        <span className="min-w-[36px] text-right text-base font-bold text-hf-black">{grams} g</span>
      </div>
      <div className="relative h-2 rounded bg-hf-tan-dark">
        <div className="absolute inset-y-0 left-0 rounded bg-hf-green" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function RegistreringPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const entry = entries[id];
  const [title, setTitle] = useState(entry?.title ?? "");

  if (!entry) {
    return (
      <div className="flex min-h-full flex-1 flex-col bg-hf-cream">
        <div className="flex items-center justify-center bg-hf-green px-4 py-4">
          <h1 className="text-lg font-extrabold text-hf-white">Registrering</h1>
        </div>
        <p className="flex-1 p-4 text-center text-sm text-hf-black opacity-60">
          Registreringen findes ikke.
        </p>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-hf-cream">
      <div className="flex items-center justify-between bg-hf-green px-4 py-4">
        <button
          onClick={() => router.back()}
          className="text-sm font-bold text-hf-white"
        >
          Annuller
        </button>
        <button
          onClick={() => router.push("/")}
          className="text-sm font-bold text-hf-white"
        >
          Luk
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="h-44 bg-hf-tan" />

        <div className="flex flex-col gap-4 p-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-transparent text-lg font-extrabold text-hf-black outline-none"
          />
          <p className="text-sm text-hf-black opacity-70">{entry.kcal} kcal</p>

          <div className="flex flex-col gap-4 rounded-2xl bg-hf-tan p-4">
            <p className="text-[15px] font-extrabold text-hf-black">Energifordeling</p>
            <MacroBar label="Protein" grams={entry.protein} max={40} />
            <MacroBar label="Kulhydrat" grams={entry.carbs} max={80} />
            <MacroBar label="Fedt" grams={entry.fat} max={30} />
          </div>

          <div className="overflow-hidden rounded-2xl bg-hf-tan">
            {entry.ingredients.map((ing, i) => (
              <div
                key={ing}
                className={`flex items-center gap-2.5 px-4 py-3 ${
                  i < entry.ingredients.length - 1 ? "border-b border-hf-tan-dark" : ""
                }`}
              >
                <div className="h-2 w-2 rounded-full bg-hf-green" />
                <span className="text-sm text-hf-black">{ing}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
