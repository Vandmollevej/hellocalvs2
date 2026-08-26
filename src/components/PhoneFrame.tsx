"use client";

import { useEffect, useState } from "react";

// iPhone 17 Pro CSS-viewport (402×874 px, forhold ~2,17:1) — opslået
// faktisk specifikation, ikke gættet.
const FRAME_WIDTH = 402;
const FRAME_HEIGHT = 874;
const MARGIN = 48;

export function PhoneFrame({ children }: { children: React.ReactNode }) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    function updateScale() {
      const availableW = window.innerWidth - MARGIN;
      const availableH = window.innerHeight - MARGIN;
      const next = Math.min(1, availableW / FRAME_WIDTH, availableH / FRAME_HEIGHT);
      setScale(next);
    }
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  return (
    <div className="phone-frame-stage flex min-h-dvh items-center justify-center bg-neutral-300 p-6">
      <div
        className="phone-frame-viewport"
        style={{ width: FRAME_WIDTH * scale, height: FRAME_HEIGHT * scale }}
      >
        <div
          className="phone-frame-device origin-top-left overflow-hidden rounded-[44px] border-[6px] border-neutral-800 bg-surface-1 shadow-2xl"
          style={{ width: FRAME_WIDTH, height: FRAME_HEIGHT, transform: `scale(${scale})` }}
        >
          <div className="phone-frame-content flex h-full flex-col overflow-y-auto">{children}</div>
        </div>
      </div>
    </div>
  );
}
