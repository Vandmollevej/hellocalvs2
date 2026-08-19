"use client";

import { useState } from "react";
import Link from "next/link";
import {
  IconPlus,
  IconToolsKitchen2,
  IconCamera,
  IconSearch,
  IconMicrophone,
} from "@tabler/icons-react";

export const HERO_HEIGHT = 280;
const CENTER_Y = HERO_HEIGHT / 2;
const RADIUS = 92;
const CIRCLE = 46;

// Four evenly spaced angles bulging right from the half-circle's curve.
const ANGLES_DEG = [-60, -20, 20, 60];

function arcPosition(angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  const x = RADIUS * Math.cos(rad) - CIRCLE / 2;
  const y = CENTER_Y + RADIUS * Math.sin(rad) - CIRCLE / 2;
  return { left: x, top: y };
}

const actions = [
  { key: "maaltid", href: "/kamera?mode=maaltid", icon: <IconToolsKitchen2 size={20} color="var(--hf-black)" />, label: "Måltid" },
  { key: "kamera", href: "/kamera?mode=produkt", icon: <IconCamera size={20} color="var(--hf-black)" />, label: "Kamera" },
  { key: "soeg", href: "/soeg", icon: <IconSearch size={20} color="var(--hf-black)" />, label: "Søg" },
  { key: "mikrofon", href: "/stemme", icon: <IconMicrophone size={20} color="var(--hf-black)" />, label: "Mikrofon" },
];

export function AddButton({ onOpen }: { onOpen?: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        aria-label={open ? "Luk tilføj-menu" : "Åbn tilføj-menu"}
        aria-expanded={open}
        onClick={() => {
          if (!open) onOpen?.();
          setOpen((v) => !v);
        }}
        className="absolute left-0 flex items-center justify-start bg-hf-green transition-transform"
        style={{
          top: "50%",
          transform: `translateY(-50%) rotate(${open ? 45 : 0}deg)`,
          width: 80,
          height: 190,
          borderRadius: "0 190px 190px 0",
          paddingLeft: 20,
          transformOrigin: "0% 50%",
        }}
      >
        <span style={{ transform: `rotate(${open ? -45 : 0}deg)`, display: "inline-flex" }}>
          <IconPlus size={28} color="var(--hf-white)" />
        </span>
      </button>

      {actions.map((action, i) => {
        const { left, top } = arcPosition(ANGLES_DEG[i]);
        return (
          <Link
            key={action.key}
            href={action.href}
            aria-label={action.label}
            className="absolute flex items-center justify-center rounded-full bg-hf-tan transition-all duration-200"
            style={{
              left,
              top,
              width: CIRCLE,
              height: CIRCLE,
              opacity: open ? 1 : 0,
              pointerEvents: open ? "auto" : "none",
              transform: open ? "scale(1)" : "scale(0.4)",
            }}
          >
            {action.icon}
          </Link>
        );
      })}
    </>
  );
}
