"use client";

import { useEffect, useRef, useState } from "react";
import { IconGripVertical } from "@tabler/icons-react";

// Træk-og-slip-liste (pointer events, virker med mus og touch). Håndtaget
// til venstre starter trækket; rækken følger fingeren, og de andre rykker.
type DragState<K> = { key: K; from: number; to: number; dy: number; height: number };

export function SortableList<T extends string>({
  items,
  onChange,
  renderItem,
  handleLabel,
}: {
  items: T[];
  onChange: (next: T[]) => void;
  renderItem: (item: T) => React.ReactNode;
  handleLabel: string;
}) {
  const rowRefs = useRef<Record<string, HTMLLIElement | null>>({});
  const [drag, setDrag] = useState<DragState<T> | null>(null);

  const dragRef = useRef<DragState<T> | null>(null);
  const itemsRef = useRef(items);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    itemsRef.current = items;
    onChangeRef.current = onChange;
  });

  function publish(next: DragState<T> | null) {
    dragRef.current = next;
    setDrag(next);
  }

  function begin(event: React.PointerEvent<HTMLButtonElement>, key: T, index: number) {
    event.preventDefault();
    const target = event.currentTarget;
    const startY = event.clientY;
    target.setPointerCapture(event.pointerId);
    publish({ key, from: index, to: index, dy: 0, height: rowRefs.current[key]?.offsetHeight ?? 48 });

    const onMove = (e: PointerEvent) => {
      const current = dragRef.current;
      if (!current) return;
      const dy = e.clientY - startY;
      const to = Math.max(0, Math.min(itemsRef.current.length - 1, current.from + Math.round(dy / current.height)));
      publish({ ...current, to, dy });
    };
    const onUp = () => {
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
      target.removeEventListener("pointercancel", onUp);
      const current = dragRef.current;
      if (current && current.from !== current.to) {
        const next = [...itemsRef.current];
        next.splice(current.to, 0, next.splice(current.from, 1)[0]);
        onChangeRef.current(next);
      }
      publish(null);
    };
    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
    target.addEventListener("pointercancel", onUp);
  }

  return (
    <ul className="flex flex-col">
      {items.map((item, index) => {
        let shift = 0;
        if (drag) {
          const height = drag.height;
          if (item === drag.key) shift = drag.dy;
          else if (drag.from < drag.to && index > drag.from && index <= drag.to) shift = -height;
          else if (drag.from > drag.to && index < drag.from && index >= drag.to) shift = height;
        }
        const dragging = drag?.key === item;
        return (
          <li
            key={item}
            ref={(node) => {
              rowRefs.current[item] = node;
            }}
            className={`flex items-center gap-3 border-b border-hf-tan-dark bg-hf-tan px-4 py-3 last:border-b-0 ${
              dragging ? "relative z-10 shadow-md" : drag ? "transition-transform" : ""
            }`}
            style={{ transform: shift ? `translateY(${shift}px)` : undefined }}
          >
            <button
              type="button"
              aria-label={handleLabel}
              className="touch-none text-hf-gray"
              onPointerDown={(event) => begin(event, item, index)}
            >
              <IconGripVertical size={20} />
            </button>
            <span className="hf-type-body flex-1 text-hf-black">{renderItem(item)}</span>
          </li>
        );
      })}
    </ul>
  );
}
