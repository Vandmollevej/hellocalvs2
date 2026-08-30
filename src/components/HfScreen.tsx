import { ScreenHeader } from "@/components/hf/ScreenHeader";
import { BottomNav } from "@/components/BottomNav";

export function HfScreen({
  title,
  icon,
  children,
  headerRight,
  footer,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  headerRight?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-hf-cream">
      <ScreenHeader title={title} icon={icon} rightAction={headerRight} />
      <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      {footer && (
        <div className="flex-shrink-0 border-t border-hf-tan-dark bg-hf-cream p-4">{footer}</div>
      )}
      <BottomNav />
    </div>
  );
}
