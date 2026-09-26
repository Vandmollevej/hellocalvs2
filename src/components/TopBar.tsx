"use client";

import Link from "next/link";
import { useFamilyStatus } from "@/components/family/FamilyStatusProvider";
import { ProfileCircle } from "@/components/family/ProfileCircle";
import { WatchPhoneIcon } from "@/components/family/WatchPhoneIcon";
import { useTranslation } from "@/i18n/LocaleProvider";

export function TopBar() {
  const { t } = useTranslation();
  const { status } = useFamilyStatus();
  const watcher = status?.presence[0] ?? null;
  return (
    <div data-top-bar className="flex items-center justify-end gap-2 px-4 pt-4">
      {watcher && (
        <WatchPhoneIcon name={watcher.displayName} title={t("family.watch.onAccount", { name: watcher.displayName })} />
      )}
      <Link href="/profile" aria-label={t("settings.openProfile")}>
        <ProfileCircle name={status?.activeProfile.displayName ?? ""} />
      </Link>
    </div>
  );
}
