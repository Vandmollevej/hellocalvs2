import { IconChevronLeft } from "@tabler/icons-react";

export function ScreenHeader({
  title,
  onBack,
  rightAction,
}: {
  title: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
}) {
  return (
    <div className="relative flex flex-col items-center justify-end bg-hf-green px-4 pb-4 pt-9">
      {onBack && (
        <button
          onClick={onBack}
          aria-label="Tilbage"
          className="absolute left-4 bottom-4 text-hf-white"
        >
          <IconChevronLeft size={26} />
        </button>
      )}
      <h1 className="hf-heading text-lg text-hf-white">{title}</h1>
      {rightAction && (
        <div className="absolute bottom-3 right-3">{rightAction}</div>
      )}
    </div>
  );
}
