"use client";

import { useFamilyStatus } from "@/components/family/FamilyStatusProvider";
import { WatchPhoneIcon } from "@/components/family/WatchPhoneIcon";
import { ProfileAvatarLink } from "@/components/ProfileAvatarLink";
import { useTranslation } from "@/i18n/LocaleProvider";

// Samme højde, sidemargin og 44 px-slot som .hf-appbar, så profilcirklen
// står præcis samme sted og har samme størrelse som på sider med ScreenHeader.
export function TopBar() {
  const { t } = useTranslation();
  const { status } = useFamilyStatus();
  const watcher = status?.presence[0] ?? null;
  return (
    <div data-top-bar className="hf-topbar gap-2">
      {watcher && (
        <span className="userback-ignore userback-block flex">
          <WatchPhoneIcon name={watcher.displayName} title={t("family.watch.onAccount", { name: watcher.displayName })} />
        </span>
      )}
      <ProfileAvatarLink outlined />
    </div>
  );
}
