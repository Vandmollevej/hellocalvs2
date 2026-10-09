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
  leading,
  topBanner,
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
  leading?: React.ReactNode;
  /** Lag oven på indholdet, forankret under topbaren (fx opdater-banneret på varesiden) — skubber aldrig siden. */
  topBanner?: React.ReactNode;
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
        leading={leading}
      />
      <div className="relative min-h-0 flex-1">
        {topBanner}
        <div className="h-full overflow-y-auto overscroll-contain">{children}</div>
      </div>
      {footer && (
        <div className="flex-shrink-0 bg-hf-cream p-4">{footer}</div>
      )}
      <BottomNav />
    </div>
  );
}
