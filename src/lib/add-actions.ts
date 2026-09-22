import { useEffect, useState, useSyncExternalStore } from "react";
import {
  IconCalendarHeart,
  IconCamera,
  IconDroplet,
  IconMicrophone,
  IconRulerMeasure,
  IconSearch,
  IconTarget,
  type Icon,
} from "@tabler/icons-react";
import { IconBathroomScale } from "@/components/icons/BathroomScale";

// Every real "add something" destination in the app — the pool the
// front-page joystick wheel (AddButton.tsx) can show a subset of, and the
// full list shown by /add/menu ("all add elements"). One source of truth so
// neither place can drift from the other.
export type AddActionKey =
  | "microphone"
  | "ownDishes"
  | "search"
  | "weight"
  | "water"
  | "camera"
  | "targetWeight"
  | "bodyMeasurements"
  | "menstrualCycle";

export type AddAction = {
  key: AddActionKey;
  href: string;
  icon?: Icon;
  imageSrc?: string;
  /** i18n key for the row/aria-label shown on /add/menu and the settings toggle list. */
  labelKey: string;
  /** i18n key for the short green hint label shown next to a highlighted wheel icon. */
  hintKey: string;
  /**
   * When true, this action only appears once the user has both sex = FEMALE
   * and User.cycleTrackingEnabled on (Indstillinger → Visning →
   * Menstruationscyklus) — see docs/DECISIONS.md 2026-09-19. Every consumer
   * of ADD_ACTIONS (AddButton wheel, /add/menu, the front-page settings
   * toggle list) must filter through `visibleAddActions()` below rather than
   * rendering ADD_ACTIONS directly, so this stays consistent everywhere.
   */
  requiresCycleTracking?: boolean;
};

export const ADD_ACTIONS: AddAction[] = [
  {
    key: "microphone",
    href: "/voice",
    icon: IconMicrophone,
    labelKey: "addButton.microphone",
    hintKey: "addButton.hint.microphone",
  },
  {
    key: "ownDishes",
    href: "/create-dish",
    imageSrc: "/icons/gryde.png",
    labelKey: "addButton.ownDishes",
    hintKey: "addButton.hint.ownDishes",
  },
  {
    key: "search",
    href: "/search",
    icon: IconSearch,
    labelKey: "addButton.search",
    hintKey: "addButton.hint.search",
  },
  {
    key: "weight",
    href: "/weight/create",
    icon: IconBathroomScale,
    labelKey: "addButton.weight",
    hintKey: "addButton.hint.weight",
  },
  {
    key: "water",
    href: "/water/create",
    icon: IconDroplet,
    labelKey: "addButton.water",
    hintKey: "addButton.hint.water",
  },
  {
    key: "camera",
    href: "/camera?mode=product",
    icon: IconCamera,
    labelKey: "addButton.camera",
    hintKey: "addButton.hint.camera",
  },
  {
    key: "targetWeight",
    href: "/profile/target-weight",
    icon: IconTarget,
    labelKey: "profile.actions.target",
    hintKey: "profile.actions.target",
  },
  {
    key: "bodyMeasurements",
    href: "/profile/body-measurements",
    icon: IconRulerMeasure,
    labelKey: "profile.row.bodyMeasurements",
    hintKey: "profile.row.bodyMeasurements",
  },
  {
    key: "menstrualCycle",
    href: "/period/create",
    icon: IconCalendarHeart,
    labelKey: "addButton.menstrualCycle",
    hintKey: "addButton.hint.menstrualCycle",
    requiresCycleTracking: true,
  },
];

export function addActionByKey(key: AddActionKey) {
  return ADD_ACTIONS.find((action) => action.key === key);
}

/**
 * Filters ADD_ACTIONS down to what a given profile is allowed to see —
 * currently only "menstrualCycle" is gated (sex = FEMALE and the user's own
 * "Vis menstruationscyklus" toggle). Every screen that lists ADD_ACTIONS
 * should render this instead of the raw catalog.
 */
export function visibleAddActions(profile: { sex?: "FEMALE" | "MALE" | null; cycleTrackingEnabled?: boolean }) {
  return ADD_ACTIONS.filter((action) => {
    if (!action.requiresCycleTracking) return true;
    return profile.sex === "FEMALE" && profile.cycleTrackingEnabled === true;
  });
}

/**
 * Fetches just the two /api/profile fields visibleAddActions() needs, once
 * per mount. Every screen that lists ADD_ACTIONS (AddButton wheel, /add/menu,
 * settings → Visning → Forside) uses this instead of reading the full
 * profile itself.
 */
export function useAddActionsProfile(): { sex: "FEMALE" | "MALE" | null; cycleTrackingEnabled: boolean } {
  const [profile, setProfile] = useState<{ sex: "FEMALE" | "MALE" | null; cycleTrackingEnabled: boolean }>({
    sex: null,
    cycleTrackingEnabled: false,
  });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile")
      .then(async (response) => {
        if (!response.ok) throw new Error("failed");
        return (await response.json()) as {
          user: { sex: "FEMALE" | "MALE" | null; cycleTrackingEnabled: boolean };
        };
      })
      .then((data) => {
        if (!cancelled) setProfile({ sex: data.user.sex, cycleTrackingEnabled: data.user.cycleTrackingEnabled });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return profile;
}

// The wheel's top slot is always the fixed "list" action (see AddButton.tsx)
// — these are the remaining slots, user-configurable from the settings page
// below. Default matches the wheel's original 6 actions minus microphone,
// which moved into the new "list" screen instead of its own wheel slot.
export const DEFAULT_WHEEL_ACTION_KEYS: AddActionKey[] = [
  "ownDishes",
  "search",
  "weight",
  "water",
  "camera",
];

export const MAX_WHEEL_ACTIONS = 5;

const WHEEL_ACTIONS_STORAGE_KEY = "hellocal.frontpage.wheelActions";

function isAddActionKey(value: unknown): value is AddActionKey {
  return typeof value === "string" && ADD_ACTIONS.some((action) => action.key === value);
}

function parseWheelActionKeys(raw: string | null): AddActionKey[] {
  if (!raw) return DEFAULT_WHEEL_ACTION_KEYS;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_WHEEL_ACTION_KEYS;
    const keys = parsed.filter(isAddActionKey).slice(0, MAX_WHEEL_ACTIONS);
    return keys.length > 0 ? keys : DEFAULT_WHEEL_ACTION_KEYS;
  } catch {
    return DEFAULT_WHEEL_ACTION_KEYS;
  }
}

// useSyncExternalStore (not a plain lazy useState + localStorage read) is
// what makes this SSR/hydration-safe: the server (and the client's first
// hydration pass) always sees DEFAULT_WHEEL_ACTION_KEYS via getServerSnapshot
// below, then React immediately re-renders with the real client snapshot if
// it differs — no hydration mismatch, unlike reading localStorage inside a
// useState initializer.
let cachedRaw: string | null | undefined;
let cachedKeys: AddActionKey[] = DEFAULT_WHEEL_ACTION_KEYS;

function getSnapshot(): AddActionKey[] {
  if (typeof window === "undefined") return DEFAULT_WHEEL_ACTION_KEYS;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(WHEEL_ACTIONS_STORAGE_KEY);
  } catch {
    return DEFAULT_WHEEL_ACTION_KEYS;
  }
  if (raw === cachedRaw) return cachedKeys;
  cachedRaw = raw;
  cachedKeys = parseWheelActionKeys(raw);
  return cachedKeys;
}

function getServerSnapshot(): AddActionKey[] {
  return DEFAULT_WHEEL_ACTION_KEYS;
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === WHEEL_ACTIONS_STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Persists the wheel's chosen actions and notifies every mounted `useWheelActionKeys()`. */
export function saveWheelActionKeys(keys: AddActionKey[]) {
  if (typeof window === "undefined") return;
  const next = keys.slice(0, MAX_WHEEL_ACTIONS);
  try {
    window.localStorage.setItem(WHEEL_ACTIONS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable — ignore, same as stat-cards.ts.
  }
  // The 'storage' event only fires in OTHER tabs — force this tab's own
  // subscribers (e.g. the settings toggle list) to re-read immediately too.
  cachedRaw = undefined;
  listeners.forEach((listener) => listener());
}

/** The wheel's current chosen actions (settings → Visning → Forside), reactive and SSR-safe. */
export function useWheelActionKeys(): AddActionKey[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
