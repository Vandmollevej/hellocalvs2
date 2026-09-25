"use client";

import { IconGift } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { AccordionCard } from "@/components/hf/AccordionCard";
import { HfChevron } from "@/components/hf/HfChevron";
import { useTranslation } from "@/i18n/LocaleProvider";

// Indløsningsmuligheder for points. Første mulighed er sat op som række;
// indhold og handling bag hver mulighed kommer senere.
export default function RedeemPointsPage() {
  const { t } = useTranslation();

  return (
    <HfScreen title={t("subscription.redeemPage.title")}>
      <div className="p-4">
        <AccordionCard>
          {/* Samme række som ChevronRow, men teksten må ombrydes, da den er for lang til én linje. */}
          <button type="button" className="flex min-h-12 w-full items-center gap-4 px-4 py-3 text-left">
            <span className="flex h-5 w-5 items-center justify-center text-hf-black">
              <IconGift size={20} />
            </span>
            <span className="hf-type-body flex-1">{t("subscription.redeemPage.giftFriend")}</span>
            <HfChevron className="text-hf-black" />
          </button>
        </AccordionCard>
      </div>
    </HfScreen>
  );
}
