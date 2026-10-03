"use client";

import { useState } from "react";
import { HfChevron } from "@/components/hf/HfChevron";
import { ProfileCircle } from "@/components/family/ProfileCircle";
import type { FamilyStatus } from "@/components/family/FamilyStatusProvider";
import { SHARED_PROFILE_AREAS, peopleSharedWith } from "@/lib/family-sharing";
import { useTranslation } from "@/i18n/LocaleProvider";

// "Del med andre" øverst på Familie-siden for medlemmer (ejerens ønske
// 2026-10-03): én række "Delt med {navn}" pr. person i familien, der kan se
// din profil. Tryk folder ud og viser, hvad der deles. Navne må vises, fordi
// I er i samme familie. Betaleren bestemmer adgangen, så siden kun viser den.
export function FamilySharingSection({
  family,
  meId,
}: {
  family: NonNullable<FamilyStatus["family"]>;
  meId: string;
}) {
  const { t } = useTranslation();
  const [openId, setOpenId] = useState<string | null>(null);
  const people = peopleSharedWith(family, meId);

  return (
    <section>
      <h2 className="hf-type-section-title">{t("family.sharing.title")}</h2>
      <p className="hf-type-body mb-2">{t("family.sharing.intro", { owner: family.ownerName })}</p>
      {people.length === 0 ? (
        <p className="hf-type-body text-text-secondary">{t("family.sharing.none")}</p>
      ) : (
        <div className="overflow-hidden rounded-[8px] bg-hf-tan">
          {people.map((person) => {
            const open = openId === person.userId;
            return (
              <div key={person.userId} className="border-b border-hf-tan-dark last:border-b-0">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : person.userId)}
                  aria-expanded={open}
                  className="flex h-14 w-full items-center gap-4 px-4 text-left"
                >
                  <ProfileCircle name={person.displayName} tone="card" />
                  <span className="userback-ignore userback-block hf-type-body flex-1 truncate">
                    {t("family.sharing.sharedWith", { name: person.displayName })}
                  </span>
                  <HfChevron direction={open ? "up" : "down"} className="text-hf-black" />
                </button>
                {open && (
                  <div className="hf-stack px-4 pb-4">
                    <p className="hf-type-caption text-text-secondary">
                      {person.isOwner
                        ? t("family.sharing.ownerNote", { name: person.displayName })
                        : t("family.sharing.grantNote", { name: person.displayName, owner: family.ownerName })}
                    </p>
                    <ul className="hf-type-body list-disc pl-5">
                      {SHARED_PROFILE_AREAS.map((area) => (
                        <li key={area}>{t(`family.sharing.area.${area}`)}</li>
                      ))}
                    </ul>
                    <p className="hf-type-caption text-text-secondary">
                      {t("family.sharing.canEdit", { name: person.displayName })}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
