"use client";

import { useState } from "react";
import { HfChevron } from "@/components/hf/HfChevron";
import { Toggle } from "@/components/ui/Toggle";
import { ProfileCircle } from "@/components/family/ProfileCircle";
import type { FamilyStatus } from "@/components/family/FamilyStatusProvider";
import { SHARED_PROFILE_AREAS, peopleSharedWith } from "@/lib/family-sharing";
import { useTranslation } from "@/i18n/LocaleProvider";

// "Del med andre" øverst på Familie-siden (ejerens ønske 2026-10-03). Den,
// der bestemmer over profilen (sharingDeciderId: voksne med eget login selv),
// slår deling til og fra pr. person i familien — det kommer ikke betaleren
// ved. Derunder én række "Delt med {navn}" pr. person, der kan se profilen;
// tryk folder ud og viser, hvad der deles. Navne må vises, fordi I er i samme
// familie. Betaleren har altid adgang og kan ikke slås fra.
export function FamilySharingSection({
  family,
  meId,
  busy,
  onShare,
}: {
  family: NonNullable<FamilyStatus["family"]>;
  meId: string;
  busy: boolean;
  onShare: (granteeId: string, allowed: boolean) => void;
}) {
  const { t } = useTranslation();
  const [openId, setOpenId] = useState<string | null>(null);
  const people = peopleSharedWith(family, meId);
  const me = family.members.find((member) => member.userId === meId);
  const decidesSelf = me?.sharingDeciderId === meId;
  const isOwner = family.ownerId === meId;
  // Dem, man selv kan dele med: alle andre i familien undtagen betaleren.
  const candidates = family.members.filter((member) => member.userId !== meId && member.userId !== family.ownerId);
  const sharedIds = new Set(people.map((person) => person.userId));

  return (
    <section>
      <h2 className="hf-type-section-title">{t("family.sharing.title")}</h2>
      <p className="hf-type-body mb-2">
        {decidesSelf
          ? isOwner
            ? t("family.sharing.introSelf")
            : t("family.sharing.introSelfMember", { owner: family.ownerName })
          : t("family.sharing.introOwner", { owner: family.ownerName })}
      </p>
      {decidesSelf && candidates.length > 0 && (
        <div className="mb-2 overflow-hidden rounded-[8px] bg-hf-tan">
          {candidates.map((member) => (
            <div
              key={member.userId}
              className="flex h-14 items-center gap-4 border-b border-hf-tan-dark px-4 last:border-b-0"
            >
              <ProfileCircle name={member.displayName} tone="card" />
              <span className="userback-ignore userback-block hf-type-body flex-1 truncate">{member.displayName}</span>
              <Toggle
                ariaLabel={t("family.sharing.shareWith", { name: member.displayName })}
                checked={sharedIds.has(member.userId)}
                disabled={busy}
                onChange={(value) => onShare(member.userId, value)}
              />
            </div>
          ))}
        </div>
      )}
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
                        : decidesSelf
                          ? t("family.sharing.selfGrantNote", { name: person.displayName })
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
