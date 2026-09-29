import type { ComponentType } from "react";
import {
  IconActivity,
  IconAdjustments,
  IconApple,
  IconCalendar,
  IconChefHat,
  IconDroplet,
  IconLifebuoy,
  IconMessageCircle,
  IconPlugConnected,
  IconPlus,
  IconScale,
  IconSearch,
  IconSettings,
  IconStar,
  IconTarget,
  IconUser,
  IconUserEdit,
  IconWallet,
  IconCarrot,
} from "@tabler/icons-react";
import { TrendIcon } from "@/components/BottomNav";

// Menuer til desktop-skallen (docs/DECISIONS.md 2026-09-29). `labelKey` er en
// nøgle i oversættelsesfilerne. Topbjælken er appens bundmenu uden kamera og
// stemme; chat afløser mikrofonen.
export type WebNavItem = {
  key: string;
  href: string;
  labelKey: string;
  icon: ComponentType<{ size?: number; stroke?: number; color?: string }>;
};

function trend({ size = 20, color = "currentColor" }: { size?: number; stroke?: number; color?: string }) {
  return TrendIcon({ size, color });
}

export const WEB_TOP_NAV: WebNavItem[] = [
  { key: "tilfoej", href: "/", labelKey: "nav.add", icon: IconPlus },
  { key: "madvarer", href: "/foods", labelKey: "nav.foods", icon: IconApple },
  { key: "kalender", href: "/calendar", labelKey: "nav.calendar", icon: IconCalendar },
  { key: "statistik", href: "/statistics", labelKey: "nav.statistics", icon: trend },
  { key: "soeg", href: "/search", labelKey: "nav.search", icon: IconSearch },
  { key: "chat", href: "/chat", labelKey: "web.chat", icon: IconMessageCircle },
];

export const WEB_SHORTCUTS: WebNavItem[] = [
  { key: "tilfoej", href: "/", labelKey: "nav.add", icon: IconPlus },
  { key: "madvarer", href: "/foods", labelKey: "nav.foods", icon: IconApple },
  { key: "retter", href: "/profile/recipes", labelKey: "web.recipes", icon: IconChefHat },
  { key: "ingredienser", href: "/ingredients", labelKey: "web.ingredients", icon: IconCarrot },
  { key: "kalender", href: "/calendar", labelKey: "nav.calendar", icon: IconCalendar },
  { key: "statistik", href: "/statistics", labelKey: "nav.statistics", icon: trend },
  { key: "vand", href: "/water/create", labelKey: "web.water", icon: IconDroplet },
  { key: "vaegt", href: "/weight/create", labelKey: "web.weight", icon: IconScale },
  { key: "aktivitet", href: "/activity/create", labelKey: "web.activity", icon: IconActivity },
  { key: "chat", href: "/chat", labelKey: "web.chat", icon: IconMessageCircle },
];

export const WEB_SETTINGS: WebNavItem[] = [
  { key: "profil", href: "/profile", labelKey: "nav.profile", icon: IconUser },
  { key: "rediger", href: "/profile/edit", labelKey: "web.editProfile", icon: IconUserEdit },
  { key: "maal", href: "/profile/goals", labelKey: "web.goals", icon: IconTarget },
  { key: "abonnement", href: "/profile/subscription", labelKey: "web.subscription", icon: IconStar },
  { key: "integrationer", href: "/settings/integrations", labelKey: "web.integrations", icon: IconPlugConnected },
  { key: "visning", href: "/settings/display", labelKey: "web.display", icon: IconAdjustments },
  { key: "betaling", href: "/settings/payment", labelKey: "web.payment", icon: IconWallet },
  { key: "support", href: "/settings/support", labelKey: "web.support", icon: IconLifebuoy },
  { key: "alle", href: "/settings", labelKey: "web.allSettings", icon: IconSettings },
];
