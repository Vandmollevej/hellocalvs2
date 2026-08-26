"use client";

import { useState } from "react";
import { HfScreen } from "@/components/HfScreen";

const WEEKDAYS = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

function buildMonthGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7; // mandag = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = Array(startOffset).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function KalenderPage() {
  const [reference] = useState(() => new Date());
  const year = reference.getFullYear();
  const month = reference.getMonth();
  const today = reference.getDate();

  const cells = buildMonthGrid(year, month);
  // Eksempeldata: dage hvor det brugerdefinerede mål blev nået.
  const goalsMet = new Set([2, 5, 6, 9, today]);

  const monthLabel = reference.toLocaleDateString("da-DK", {
    month: "long",
    year: "numeric",
  });

  return (
    <HfScreen title="Kalender">
      <div className="p-4">
        <p className="hf-heading mb-4 text-center text-[15px] capitalize text-hf-black">
          {monthLabel}
        </p>

        <div className="mb-2 grid grid-cols-7 text-center">
          {WEEKDAYS.map((d) => (
            <span key={d} className="text-xs font-medium text-hf-black opacity-60">
              {d}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((day, i) => {
            if (day === null) return <div key={i} />;
            const met = goalsMet.has(day);
            const isToday = day === today;
            return (
              <div
                key={i}
                className={`flex aspect-square items-center justify-center rounded-lg text-sm font-medium ${
                  met ? "bg-hf-green text-hf-white" : "bg-hf-tan text-hf-black"
                } ${isToday && !met ? "outline outline-2 outline-hf-black" : ""}`}
              >
                {day}
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-center text-xs text-hf-black opacity-60">
          Grøn markering = dagens mål blev nået
        </p>
      </div>
    </HfScreen>
  );
}
