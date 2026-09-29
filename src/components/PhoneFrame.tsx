"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { isPublicPath } from "@/components/AuthGate";
import { WebShell } from "@/components/web/WebShell";

// iPhone 17 Pro CSS viewport (402×874 px, ratio ~2.17:1) — looked up
// from the actual spec, not guessed.
const FRAME_WIDTH = 402;
const FRAME_HEIGHT = 874;
const MARGIN = 48;

// Desktop (bred skærm med mus) får web-versionen i stedet for telefonrammen.
const DESKTOP_QUERY = "(min-width: 1024px) and (hover: hover) and (pointer: fine)";

function subscribeDesktop(onChange: () => void) {
  const mq = window.matchMedia(DESKTOP_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

export function PhoneFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [scale, setScale] = useState(1);
  const isDesktop = useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  );

  // The admin surface (docs/ADMIN.md) is a separate, desktop-and-mobile
  // responsive interface, not a simulated-phone consumer screen — it renders
  // full-viewport on every device instead of inside the phone chrome.
  // /hello-doc/[token] (docs/STATUS.md "Next work" #12A) is the same kind of
  // exception: an external doctor/dietitian opens it directly from an email
  // link, most likely on a laptop, and its own layout is already responsive
  // two-column — it must not be squeezed into a 402px phone bezel either.
  const isFullViewport = (pathname?.startsWith("/admin") || pathname?.startsWith("/hello-doc")) ?? false;

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

  if (isFullViewport) return <>{children}</>;

  // Log ind, opret og øvrige offentlige sider bliver i telefonrammen.
  if (isDesktop && !isPublicPath(pathname ?? "/")) return <WebShell>{children}</WebShell>;

  return (
    <div className="phone-frame-stage flex min-h-dvh items-center justify-center bg-hf-tan-dark p-6">
      <div
        className="phone-frame-viewport"
        style={{ width: FRAME_WIDTH * scale, height: FRAME_HEIGHT * scale }}
      >
        <div
          className="phone-frame-device origin-top-left overflow-hidden rounded-[44px] border-[6px] border-hf-black bg-hf-cream shadow-2xl"
          style={{ width: FRAME_WIDTH, height: FRAME_HEIGHT, transform: `scale(${scale})` }}
        >
          <div className="phone-frame-content flex h-full flex-col overflow-hidden overscroll-contain">{children}</div>
        </div>
      </div>
    </div>
  );
}
