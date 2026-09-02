import Link from "next/link";
import { IconArrowLeft } from "@tabler/icons-react";

export function ScreenHeader({
  title,
  icon,
  onBack,
  rightAction,
  variant = "brand",
}: {
  title: string;
  icon?: React.ReactNode;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  variant?: "brand" | "main";
}) {
  return (
    <div
      className={`hf-appbar ${variant === "main" ? "hf-appbar--main" : "hf-appbar--brand"}`}
    >
      <div className="hf-appbar__slot">
        <Link href="/profil" aria-label="Åbn mine oplysninger">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-hf-tan text-xs font-bold text-hf-black">
            PT
          </span>
        </Link>
      </div>
      <div className="flex items-center justify-center gap-2 overflow-hidden">
        {icon && (
          <span className="flex shrink-0 text-hf-white" aria-hidden="true">
            {icon}
          </span>
        )}
        <h1 className="hf-type-nav-title hf-appbar__title">{title}</h1>
      </div>
      <div className="hf-appbar__slot">
        {onBack ? (
          <button onClick={onBack} aria-label="Tilbage" className="text-hf-white">
            <IconArrowLeft size={24} />
          </button>
        ) : (
          rightAction
        )}
      </div>
    </div>
  );
}
