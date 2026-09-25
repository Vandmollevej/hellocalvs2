import { ScreenHeader } from "@/components/hf/ScreenHeader";
import { BottomNav } from "@/components/BottomNav";

export function HfScreen({
  title,
  icon,
  children,
  onBack,
  hideBackButton,
  footer,
  titleClassName,
  alwaysShowBackButton,
  showAppSettingsButton,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  onBack?: () => void;
  hideBackButton?: boolean;
  footer?: React.ReactNode;
  titleClassName?: string;
  alwaysShowBackButton?: boolean;
  showAppSettingsButton?: boolean;
}) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-hf-cream">
      <ScreenHeader
        title={title}
        icon={icon}
        onBack={onBack}
        hideBackButton={hideBackButton}
        titleClassName={titleClassName}
        alwaysShowBackButton={alwaysShowBackButton}
        showAppSettingsButton={showAppSettingsButton}
      />
      <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      {footer && (
        <div className="flex-shrink-0 bg-hf-cream p-4">{footer}</div>
      )}
      <BottomNav />
    </div>
  );
}
