import type { ComponentType } from "react";
import {
  IconActivity,
  IconAdjustments,
  IconAlertTriangle,
  IconApple,
  IconArrowsSort,
  IconBell,
  IconBook,
  IconBook2,
  IconBug,
  IconBulb,
  IconCalendar,
  IconCalendarHeart,
  IconCalendarWeek,
  IconChartLine,
  IconClipboardHeart,
  IconCreditCard,
  IconEye,
  IconFileText,
  IconHelp,
  IconHeartbeat,
  IconHistory,
  IconHome2,
  IconLifebuoy,
  IconMail,
  IconMessageCircle,
  IconMoon,
  IconPlugConnected,
  IconRefresh,
  IconRuler,
  IconSearch,
  IconStar,
  IconStethoscope,
  IconTilde,
  IconTrashOff,
  IconUser,
  IconUsers,
  IconWorld,
} from "@tabler/icons-react";
import { IconBathroomScale } from "@/components/icons/BathroomScale";
import { IconPartyPopper } from "@/components/icons/PartyPopper";
import { IconCookingPot } from "@/components/icons/CookingPot";
import { IconWaterGlass } from "@/components/icons/WaterGlass";
import { IconFavorite } from "@/components/icons/Favorite";
import { IconPaymentCard } from "@/components/icons/PaymentCard";
import { IconWaistMeasure } from "@/components/icons/WaistMeasure";
import { TrendIcon } from "@/components/BottomNav";

// Menuer til desktop-skallen (docs/DECISIONS.md 2026-09-29). `labelKey` er en
// nøgle i oversættelsesfilerne. Topbjælken er appens bundmenu uden kamera,
// stemme og forsidens drejehjul; chat afløser mikrofonen, og desktop starter
// i kalenderens dagsvisning (WEB_HOME).
//
// Webversionen skal kunne alt, hvad appen kan, undtagen det, der kræver
// kameraet (bruger 2026-10-11). Sidebjælken følger derfor appens egne menuer
// punkt for punkt: Profil-siden (`src/app/profile/page.tsx`), Indstillinger
// (`src/app/settings/page.tsx`, `settings/display/page.tsx`), bundmenuens
// valgfrie ikoner (`src/lib/navigation.ts`) og tilføj-menuen
// (`src/lib/add-actions.ts`, vises via plus-cirklen). Testen
// `src/lib/web-nav.test.mjs` fejler, når appen får et nyt punkt, som denne
// fil ikke dækker — føj det til menuen her (eller til undtagelserne i testen
// med en begrundelse).
export type WebNavCondition =
  // Kun for kvindelig profil (Menstruationscyklus).
  | "female"
  // Har familieabonnement eller er med i en familie (Familie).
  | "family"
  // Har oprettet/styrer andre profiler (Sletning af registreringer).
  | "controlsOthers"
  // Er med i en andens familie og kontrolleres (Kontrol-log).
  | "controlled";

export type WebNavBadge = "messages" | "controlLog";

export type WebNavItem = {
  key: string;
  href: string;
  labelKey: string;
  icon: ComponentType<{ size?: number; stroke?: number; color?: string }>;
  // Undermenu (fx Visning): foldes ud under punktet i sidebjælken.
  children?: WebNavItem[];
  // Punktet vises kun, når betingelsen gælder for den indloggede profil.
  requires?: WebNavCondition;
  // Grønt tal ved punktet (ulæste beskeder, ulæste kontrol-hændelser).
  badge?: WebNavBadge;
  // Statisk side i public/ uden for appen (hjælpecentret): fuld sideindlæsning.
  external?: "help";
  // Handling frem for en side (fx "Lær appen at kende" på /settings?guide=1):
  // markeres aldrig som aktiv og gør ikke målsiden til topniveau-side.
  action?: boolean;
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
// opfinder ingen nye. Resten af tilføj-menuen (Mål, Kropsmål, Menstruation,
// Drinks, Screening) ligger bag plus-cirklen i topbjælken.
export const WEB_SHORTCUTS: WebNavItem[] = [
  { key: "retter", href: "/profile/recipes", labelKey: "web.recipes", icon: IconBook2 },
  { key: "opret-ret", href: "/create-dish", labelKey: "web.createDish", icon: IconCookingPot },
  { key: "vand", href: "/water/create", labelKey: "web.water", icon: IconWaterGlass },
  { key: "vaegt", href: "/weight/create", labelKey: "web.weight", icon: IconBathroomScale },
  { key: "aktivitet", href: "/activity/create", labelKey: "web.activity", icon: IconActivity },
  { key: "favoritter", href: "/favorites", labelKey: "nav.favorites", icon: IconFavorite },
];

// Appens Profil-side: Profil / Beskeder / Status / Point, kroppen (vægt, mål,
// søvn, screeninger), og Viden / Hello Doc. Billeddagbogen er udeladt, fordi
// den kræver kameraet.
export const WEB_PROFILE: WebNavItem[] = [
  { key: "profil", href: "/profile", labelKey: "nav.profile", icon: IconUser },
  { key: "rediger", href: "/profile/edit", labelKey: "web.editProfile", icon: IconUser },
  { key: "beskeder", href: "/profile/messages", labelKey: "settings.messages", icon: IconMail, badge: "messages" },
  { key: "status", href: "/profile/status", labelKey: "profile.row.status", icon: IconChartLine },
  { key: "point", href: "/profile/points", labelKey: "profile.row.points", icon: IconStar },
  { key: "maal", href: "/profile/goals", labelKey: "web.goals", icon: IconPartyPopper },
  { key: "vaegtkalibrering", href: "/profile/weight-calibration", labelKey: "profile.row.weightCalibration", icon: IconBathroomScale },
  { key: "kropsmaal", href: "/profile/body-measurements", labelKey: "profile.row.bodyMeasurements", icon: IconWaistMeasure },
  { key: "soevnmoenster", href: "/profile/sleep", labelKey: "profile.row.sleep", icon: IconMoon },
  { key: "cardio", href: "/profile/cardio", labelKey: "profile.row.cardio", icon: IconHeartbeat },
  { key: "screeninger", href: "/profile/screenings", labelKey: "profile.row.screenings", icon: IconClipboardHeart },
  { key: "viden", href: "/viden-om", labelKey: "profile.row.knowledge", icon: IconBook },
  { key: "hello-doc", href: "/settings/hello-doc", labelKey: "settings.helloDoc", icon: IconStethoscope },
];

// Appens Indstillinger i samme rækkefølge. Familie-punkterne vises kun for dem,
// de gælder (som i appen).
export const WEB_SETTINGS: WebNavItem[] = [
  { key: "sprog", href: "/profile/settings/language-region", labelKey: "settings.languageAndRegion", icon: IconWorld },
  { key: "familie", href: "/profile/family", labelKey: "family.title", icon: IconUsers, requires: "family" },
  { key: "slet-tilladelser", href: "/settings/delete-permissions", labelKey: "family.deletePermissions.title", icon: IconTrashOff, requires: "controlsOthers" },
  { key: "kontrol-log", href: "/settings/control-log", labelKey: "family.log.title", icon: IconHistory, requires: "controlled", badge: "controlLog" },
  { key: "abonnement", href: "/profile/subscription", labelKey: "web.subscription", icon: IconCreditCard },
  { key: "betaling", href: "/settings/payment", labelKey: "web.payment", icon: IconPaymentCard },
  { key: "opsaetning", href: "/profile/settings", labelKey: "settings.setupTitle", icon: IconAdjustments },
  // Starter "Lær appen at kende" forfra (samme handling som i appens indstillinger).
  { key: "kontoopsaetning", href: "/settings?guide=1", labelKey: "settings.learnTheApp", icon: IconRefresh, action: true },
  { key: "integrationer", href: "/settings/integrations", labelKey: "web.integrations", icon: IconPlugConnected },
  { key: "kommunikation", href: "/profile/notifications", labelKey: "settings.notifications", icon: IconBell },
  {
    key: "visning",
    href: "/settings/display/priority",
    labelKey: "web.display",
    icon: IconEye,
    children: [
      { key: "prioritering", href: "/settings/display/priority", labelKey: "circleBadges.priorityTitle", icon: IconArrowsSort },
      { key: "forside", href: "/settings/display/front-page", labelKey: "settings.frontPage", icon: IconHome2 },
      { key: "resultatvisning", href: "/profile/settings/results", labelKey: "settings.resultsDisplay", icon: IconEye },
      { key: "kropsmaal-visning", href: "/settings/display/body-measurements", labelKey: "settings.bodyMeasurementsDisplay", icon: IconRuler },
      { key: "graenser", href: "/settings/display/limits", labelKey: "settings.recommendedLimits", icon: IconAlertTriangle },
      { key: "usikkerhed", href: "/settings/display/uncertainty", labelKey: "displaySettings.uncertainty", icon: IconTilde },
      { key: "kalendervisning", href: "/settings/display/calendar-view", labelKey: "settings.calendarView", icon: IconCalendarWeek },
      { key: "soevn", href: "/settings/display/sleep-quality", labelKey: "settings.sleepQuality", icon: IconMoon },
      { key: "tips", href: "/settings/display/tips", labelKey: "settings.tipsTitle", icon: IconBulb },
      { key: "cyklus", href: "/settings/display/menstrual-cycle", labelKey: "settings.menstrualCycle", icon: IconCalendarHeart, requires: "female" },
    ],
  },
  // Appens nederste kort: hjælpecenter, fejlrapport og de juridiske sider.
  // "Kontakt support" er Support-boksen nederst (WEB_SUPPORT).
  { key: "hjaelpecenter", href: "/hjaelp.html", labelKey: "settings.helpCenter", icon: IconHelp, external: "help" },
  { key: "fejlrapport", href: "/profile/report-bug", labelKey: "profile.row.reportBug", icon: IconBug },
  { key: "betingelser", href: "/betingelser", labelKey: "settings.terms", icon: IconFileText },
  { key: "privatlivspolitik", href: "/privatlivspolitik", labelKey: "settings.privacyPolicy", icon: IconFileText },
  { key: "datasporing", href: "/privatlivspolitik#datasporing", labelKey: "settings.dataTracking", icon: IconFileText },
];

// Support står for sig nederst i sidebjælken, i en egen boks under en
// skillelinje (bruger 2026-10-11), ikke blandt indstillingerne.
export const WEB_SUPPORT: WebNavItem = {
  key: "support",
  href: "/settings/support",
  labelKey: "web.support",
  icon: IconLifebuoy,
};

// Sidebjælkens afsnit i rækkefølge: overskriftens oversættelsesnøgle + punkter.
export const WEB_SECTIONS: { key: string; titleKey: string; items: WebNavItem[] }[] = [
  { key: "shortcuts", titleKey: "web.shortcuts", items: WEB_SHORTCUTS },
  { key: "profile", titleKey: "nav.profile", items: WEB_PROFILE },
  { key: "settings", titleKey: "web.settings", items: WEB_SETTINGS },
];

export function flattenWebNav(items: WebNavItem[]): WebNavItem[] {
  return items.flatMap((item) => [item, ...(item.children ?? [])]);
}

// Topniveau-sider i desktop-skallen: alt, sidebjælken og topbjælken linker
// direkte til. De får ingen tilbagepil i sideoverskriften (som admin).
const WEB_ROOT_PATHS = new Set(
  [
    ...WEB_TOP_NAV,
    ...flattenWebNav(WEB_SHORTCUTS),
    ...flattenWebNav(WEB_PROFILE),
    ...flattenWebNav(WEB_SETTINGS),
    WEB_SUPPORT,
  ]
    .filter((item) => !item.action)
    .map((item) => item.href.split("?")[0]),
);

export function isWebRootPath(pathname: string) {
  const path = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  return WEB_ROOT_PATHS.has(path);
}
