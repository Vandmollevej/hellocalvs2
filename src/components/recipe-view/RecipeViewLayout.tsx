"use client";

import { useEffect, useRef, useState } from "react";
import { IconArrowLeft, IconShare3 } from "@tabler/icons-react";
import "./recipe-view.css";

// Rammen om en opskrift i HelloFresh-stil (docs/DECISIONS.md 2026-09-27):
// stort billede helt til kanten, tilbage/del som runde knapper over
// billedet, en massiv topbjælke med skygge når billedet er scrollet væk, og
// en fast knap nederst. Ingen bundnavigation, som hos HelloFresh.
export function RecipeViewScreen({
  imageUrl,
  backLabel,
  shareLabel,
  onBack,
  onShare,
  footer,
  scrollRef,
  children,
}: {
  imageUrl: string | null;
  backLabel: string;
  shareLabel: string;
  onBack: () => void;
  onShare?: () => void;
  footer?: React.ReactNode;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}) {
  const ownScrollRef = useRef<HTMLDivElement>(null);
  const scroller = scrollRef ?? ownScrollRef;
  const heroRef = useRef<HTMLImageElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [solid, setSolid] = useState(!imageUrl);

  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    function update() {
      const heroHeight = heroRef.current?.offsetHeight ?? 0;
      const headerHeight = headerRef.current?.offsetHeight ?? 0;
      setSolid(!heroHeight || element!.scrollTop > heroHeight - headerHeight);
    }
    update();
    element.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      element.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [scroller, imageUrl]);

  return (
    <div className="rv-screen">
      <div ref={headerRef} className={`rv-header ${solid ? "rv-header--solid" : ""}`}>
        <button type="button" onClick={onBack} aria-label={backLabel} className="rv-header-button">
          <IconArrowLeft size={24} stroke={2} />
        </button>
        {onShare && (
          <button type="button" onClick={onShare} aria-label={shareLabel} className="rv-header-button">
            <IconShare3 size={24} stroke={2} />
          </button>
        )}
      </div>
      <div ref={scroller} className="rv-scroll">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img ref={heroRef} src={imageUrl} alt="" className="rv-hero" />
        ) : (
          <div className="rv-hero rv-hero--empty" />
        )}
        <div className="rv-body">{children}</div>
      </div>
      {footer && <div className="rv-footer">{footer}</div>}
    </div>
  );
}
