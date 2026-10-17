"use client";

import { useRef, useState, type ReactNode } from "react";
import { IconAlertTriangle, IconCopy, IconTrash } from "@tabler/icons-react";
import { IconFavorite, IconFavoriteFilled } from "@/components/icons/Favorite";
import { useTranslation } from "@/i18n/LocaleProvider";

const ACTION_WIDTH = 80;
// Så mange px skal fingeren flytte sig, før vi ved, om det er et swipe eller en scroll.
const DRAG_SLOP = 6;

// Én knap bag rækken. Alle knapper ser ens ud: ikon over tekst, hvid på farve,
// 80 px bred og i fuld rækkehøjde (docs/REGLER.md → Swipe-rækker).
export type SwipeAction = {
  key: string;
  label: string;
  ariaLabel?: string;
  icon: ReactNode;
  // Baggrundsfarve, fx "bg-hf-green".
  colorClassName: string;
  pressed?: boolean;
  onClick: () => void;
};

// Den ene fælles swipe-række (bruger 2026-10-17: alle swipe-bokse skal ligne
// "Dagens tilføjelser" på forsiden). Swipe til højre = venstre knapper
// (Favorit, Kopier), swipe til venstre = højre knapper (Fejl, Slet).
export function SwipeableRow({
  onFavorite,
  isFavorite = false,
  onCopyToAccount,
  onReportError,
  onDelete,
  leftActions,
  rightActions,
  surfaceClassName = "bg-hf-tan px-4",
  children,
}: {
  onFavorite?: () => void;
  // Varen er allerede favorit: udfyldt ikon, "Gemt", og tryk fjerner favoritten.
  isFavorite?: boolean;
  // Familieabonnement (docs/FAMILY.md): kun når man styrer en anden profil.
  // Ligger til venstre ved siden af Favorit.
  onCopyToAccount?: () => void;
  onReportError?: () => void;
  onDelete?: () => void;
  // Egne knapper i stedet for/ud over de faste (fx Aktivér på screeninger).
  leftActions?: SwipeAction[];
  rightActions?: SwipeAction[];
  // Baggrund + indrykning på den forreste flade; skal matche kortet rækken ligger i.
  surfaceClassName?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();

  const left: SwipeAction[] = [
    ...(onFavorite
      ? [
          {
            key: "favorite",
            label: t(isFavorite ? "swipeableRow.favoriteSaved" : "swipeableRow.favorite"),
            ariaLabel: t(isFavorite ? "swipeableRow.removeFavorite" : "swipeableRow.saveAsFavorite"),
            icon: isFavorite ? <IconFavoriteFilled size={20} /> : <IconFavorite size={20} />,
            colorClassName: isFavorite ? "bg-hf-black" : "bg-hf-green",
            pressed: isFavorite,
            onClick: onFavorite,
          },
        ]
      : []),
    ...(onCopyToAccount
      ? [
          {
            key: "copy",
            label: t("family.copy.action"),
            icon: <IconCopy size={20} />,
            colorClassName: "bg-hf-watch",
            onClick: onCopyToAccount,
          },
        ]
      : []),
    ...(leftActions ?? []),
  ];
  const right: SwipeAction[] = [
    ...(rightActions ?? []),
    ...(onReportError
      ? [
          {
            key: "report",
            label: t("swipeableRow.reportError"),
            ariaLabel: t("swipeableRow.reportErrorAria"),
            icon: <IconAlertTriangle size={20} />,
            colorClassName: "bg-hf-gray-dark",
            onClick: onReportError,
          },
        ]
      : []),
    ...(onDelete
      ? [
          {
            key: "delete",
            label: t("swipeableRow.delete"),
            icon: <IconTrash size={20} />,
            colorClassName: "bg-hf-red-dark",
            onClick: onDelete,
          },
        ]
      : []),
  ];
  const leftWidth = left.length * ACTION_WIDTH;
  const rightWidth = right.length * ACTION_WIDTH;

  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const start = useRef<{ x: number; y: number; offset: number } | null>(null);
  // null = endnu ikke afgjort, "x" = vandret swipe, "y" = lodret scroll (vi slipper).
  const axis = useRef<"x" | "y" | null>(null);
  // Som på iPhone: én bevægelse åbner kun én side. Fra lukket låses siden af
  // første retning; en åben række kan kun lukkes, ikke trækkes over i modsat side.
  const side = useRef<"left" | "right" | null>(null);
  const suppressClick = useRef(false);

  function handlePointerDown(e: React.PointerEvent) {
    start.current = { x: e.clientX, y: e.clientY, offset: dragX };
    axis.current = null;
    side.current = dragX > 0 ? "left" : dragX < 0 ? "right" : null;
    suppressClick.current = false;
  }

  function handlePointerMove(e: React.PointerEvent) {
    const origin = start.current;
    if (!origin || axis.current === "y") return;
    const dx = e.clientX - origin.x;
    const dy = e.clientY - origin.y;
    if (axis.current === null) {
      if (Math.abs(dx) < DRAG_SLOP && Math.abs(dy) < DRAG_SLOP) return;
      axis.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (axis.current === "y") return;
      setIsDragging(true);
      suppressClick.current = true;
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    }
    const next = origin.offset + dx;
    if (side.current === null && next !== 0) side.current = next > 0 ? "left" : "right";
    const minimum = side.current === "right" ? -rightWidth : 0;
    const maximum = side.current === "left" ? leftWidth : 0;
    setDragX(Math.max(minimum, Math.min(maximum, next)));
  }

  // Slip, afbrudt berøring (fx når siden begynder at scrolle) og tab af fokus
  // ender altid helt åben eller helt lukket — aldrig hængende halvvejs.
  function handlePointerEnd() {
    const wasTap = start.current !== null && axis.current === null;
    start.current = null;
    axis.current = null;
    side.current = null;
    setIsDragging(false);
    setDragX((x) => {
      // Tryk på en åben række lukker den i stedet for at åbne linket.
      if (wasTap && x !== 0) {
        suppressClick.current = true;
        return 0;
      }
      if (leftWidth > 0 && x > leftWidth / 2) return leftWidth;
      if (rightWidth > 0 && x < -rightWidth / 2) return -rightWidth;
      return 0;
    });
  }

  function runAction(action: SwipeAction) {
    action.onClick();
    setDragX(0);
  }

  function actionButton(action: SwipeAction) {
    return (
      <button
        key={action.key}
        type="button"
        tabIndex={dragX === 0 ? -1 : 0}
        onClick={() => runAction(action)}
        aria-label={action.ariaLabel ?? action.label}
        aria-pressed={action.pressed}
        className={`hf-type-small hf-type-strong flex h-full w-20 shrink-0 flex-col items-center justify-center gap-1 text-center text-hf-white ${action.colorClassName}`}
      >
        {action.icon}
        {action.label}
      </button>
    );
  }

  const hidden = dragX === 0 && !isDragging ? " invisible" : "";

  return (
    <div className="relative overflow-hidden">
      {/* Lukket række: knapperne bag skjules, så de ikke skinner igennem
          kortets runde hjørner (rød kant nederst til højre på sidste række). */}
      {left.length > 0 && <div className={`absolute inset-y-0 left-0 flex${hidden}`}>{left.map(actionButton)}</div>}
      {right.length > 0 && <div className={`absolute inset-y-0 right-0 flex${hidden}`}>{right.map(actionButton)}</div>}

      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onLostPointerCapture={(e) => {
          // Kun når fladen selv mister fingeren. Et touch-tryk holder fingeren
          // på barnet (fx linket); når vi tager den over, bobler barnets
          // lostpointercapture herop og må ikke afbryde trækket.
          if (e.target === e.currentTarget && start.current) handlePointerEnd();
        }}
        onClickCapture={(e) => {
          if (suppressClick.current) {
            e.preventDefault();
            e.stopPropagation();
            suppressClick.current = false;
          }
        }}
        className={`relative transition-transform ${surfaceClassName}`}
        style={{
          transform: `translateX(${dragX}px)`,
          transitionDuration: isDragging ? "0ms" : "150ms",
          touchAction: "pan-y",
        }}
      >
        {children}
      </div>
    </div>
  );
}
