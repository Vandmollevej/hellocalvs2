"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/i18n/LocaleProvider";

// Viser højst tre linjer. Er teksten længere, skæres den af, og "…Vis mere"
// står til sidst på den tredje linje; et tryk folder hele teksten ud.
export function ClampedText({ text, className = "" }: { text: string; className?: string }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      if (expanded) return;
      setOverflowing(el.scrollHeight > el.clientHeight + 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text, expanded]);

  return (
    <div className="hf-clamp">
      <p ref={ref} className={`${className} ${expanded ? "" : "hf-clamp__text"}`}>
        {text}
      </p>
      {overflowing && !expanded && (
        <button type="button" className="hf-clamp__more" onClick={() => setExpanded(true)}>
          …{t("addProduct.showMore")}
        </button>
      )}
      {expanded && (
        <button type="button" className="hf-clamp__less" onClick={() => setExpanded(false)}>
          {t("addProduct.showLess")}
        </button>
      )}
    </div>
  );
}
