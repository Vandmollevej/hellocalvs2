import type { ComponentType } from "react";
import {
  IconActivity,
  IconAdjustments,
  IconApple,
  IconBook2,
  IconCalendar,
  IconCreditCard,
  IconLifebuoy,
  IconMessageCircle,
  IconPlugConnected,
  IconSearch,
  IconSettings,
  IconUser,
  IconWallet,
} from "@tabler/icons-react";
import { IconBathroomScale } from "@/components/icons/BathroomScale";
import { IconChampagne } from "@/components/icons/Champagne";
import { IconCookingPot } from "@/components/icons/CookingPot";
import { IconWaterGlass } from "@/components/icons/WaterGlass";
import { TrendIcon } from "@/components/BottomNav";

// Menuer til desktop-skallen (docs/DECISIONS.md 2026-09-29). `labelKey` er en
// nøgle i oversættelsesfilerne. Topbjælken er appens bundmenu uden kamera,
// stemme og forsidens drejehjul; chat afløser mikrofonen, og desktop starter
// i kalenderens dagsvisning (WEB_HOME).
export type WebNavItem = {
  key: string;
  href: string;
  labelKey: string;
  icon: ComponentType<{ size?: number; stroke?: number; color?: string }>;
};

function trend({ size = 20, color = "currentColor" }: { size?: number; stroke?: number; color?: string }) {
  return TrendIcon({ size, color });
}

export const WEB_HOME = "/calendar?view=day";

export const WEB_TOP_NAV: WebNavItem[] = [
  { key: "kalender", href: WEB_HOME, labelKey: "nav.calendar", icon: IconCalendar },
  { key: "madvarer", href: "/foods", labelKey: "nav.foods", icon: IconApple },
  { key: "statistik", href: "/statistics", labelKey: "nav.statistics", icon: trend },
  { key: "soeg", href: "/search", labelKey: "nav.search", icon: IconSearch },
  { key: "chat", href: "/chat", labelKey: "web.chat", icon: IconMessageCircle },
];

// Sidebjælken viser kun det, topbjælken ikke allerede har (Kalender, Madvarer,
// Statistik, Søg og Chat står kun i toppen). Ikonerne er appens egne — de
// samme som i bundmenuen, tilføj-menuen og profil/indstillinger; webben
// opfinder ingen nye.
export const WEB_SHORTCUTS: WebNavItem[] = [
  { key: "retter", href: "/profile/recipes", labelKey: "web.recipes", icon: IconBook2 },
  { key: "opret-ret", href: "/create-dish", labelKey: "web.createDish", icon: IconCookingPot },
  { key: "vand", href: "/water/create", labelKey: "web.water", icon: IconWaterGlass },
  { key: "vaegt", href: "/weight/create", labelKey: "web.weight", icon: IconBathroomScale },
  { key: "aktivitet", href: "/activity/create", labelKey: "web.activity", icon: IconActivity },
];

export const WEB_SETTINGS: WebNavItem[] = [
  { key: "profil", href: "/profile", labelKey: "nav.profile", icon: IconUser },
  { key: "rediger", href: "/profile/edit", labelKey: "web.editProfile", icon: IconUser },
  { key: "maal", href: "/profile/goals", labelKey: "web.goals", icon: IconChampagne },
  { key: "abonnement", href: "/profile/subscription", labelKey: "web.subscription", icon: IconCreditCard },
  { key: "integrationer", href: "/settings/integrations", labelKey: "web.integrations", icon: IconPlugConnected },
  { key: "visning", href: "/settings/display", labelKey: "web.display", icon: IconAdjustments },
  { key: "betaling", href: "/settings/payment", labelKey: "web.payment", icon: IconWallet },
  { key: "support", href: "/settings/support", labelKey: "web.support", icon: IconLifebuoy },
  { key: "alle", href: "/settings", labelKey: "web.allSettings", icon: IconSettings },
];

// Sider, der ikke længere har eget menupunkt, men stadig er topniveau (ingen
// tilbagepil): Ingredienser nås fra Opret ret.
const EXTRA_ROOT_PATHS = ["/ingredients"];
// Topniveau-sider i desktop-skallen: alt, sidebjælken og topbjælken linker
// direkte til. De får ingen tilbagepil i sideoverskriften (som admin).
const WEB_ROOT_PATHS = new Set([...WEB_TOP_NAV, ...WEB_SHORTCUTS, ...WEB_SETTINGS].map((item) => item.href.split("?")[0]).concat(EXTRA_ROOT_PATHS));

export function isWebRootPath(pathname: string) {
  const path = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  return WEB_ROOT_PATHS.has(path);
}
