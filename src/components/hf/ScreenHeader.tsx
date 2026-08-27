import { IconChevronLeft } from "@tabler/icons-react";

export function ScreenHeader({
  title,
  icon,
  onBack,
  rightAction,
}: {
  title: string;
  icon?: React.ReactNode;
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
      <div className="flex items-center gap-2">
        {icon && (
          <span className="flex text-hf-white" aria-hidden="true">
            {icon}
          </span>
        )}
        <h1 className="hf-heading text-lg text-hf-white">{title}</h1>
      </div>
      {rightAction && (
        <div className="absolute bottom-3 right-3">{rightAction}</div>
      )}
    </div>
  );
}
