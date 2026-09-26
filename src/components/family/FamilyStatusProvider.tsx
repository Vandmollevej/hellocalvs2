"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isPublicPath } from "@/components/AuthGate";

// Familiestatus (docs/FAMILY.md): hvilken profil der vises, hvilke profiler
// man kan skifte til, og om en anden person er på den viste profil lige nu
// (blå ramme + telefonikon). Hentes ved sideskift og hvert halve minut.

export type FamilyProfile = { id: string; displayName: string; isChild: boolean };

export type FamilyMemberInfo = {
  userId: string;
  displayName: string;
  isChild: boolean;
  age: number | null;
  hasLogin: boolean;
  createdByOwner: boolean;
};

export type FamilyStatus = {
  me: { id: string; displayName: string };
  activeProfile: FamilyProfile;
  profiles: FamilyProfile[];
  family: {
    id: string;
    ownerId: string;
    ownerName: string;
    isOwner: boolean;
    members: FamilyMemberInfo[];
    grants: { granteeId: string; subjectId: string }[];
  } | null;
  hasFamilyPlan: boolean;
  maxProfiles: number;
  presence: { id: string; displayName: string }[];
  unseenCount: number;
};

type FamilyContextValue = {
  status: FamilyStatus | null;
  refresh: () => Promise<void>;
  switchProfile: (profileId: string) => Promise<boolean>;
  // true når man ser en andens profil (ikke sin egen).
  actingForOther: boolean;
};

const FamilyContext = createContext<FamilyContextValue>({
  status: null,
  refresh: async () => {},
  switchProfile: async () => false,
  actingForOther: false,
});

const POLL_MS = 30_000;

export function FamilyStatusProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [status, setStatus] = useState<FamilyStatus | null>(null);
  const isPublic = isPublicPath(pathname);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/family", { cache: "no-store" });
      if (res.status === 401) {
        setStatus(null);
        return;
      }
      if (res.ok) setStatus((await res.json()) as FamilyStatus);
    } catch {
      // Offline — behold sidste kendte status.
    }
  }, []);

  useEffect(() => {
    if (isPublic) return;
    let cancelled = false;
    const load = () => {
      if (!cancelled && document.visibilityState === "visible") void refresh();
    };
    load();
    const timer = window.setInterval(load, POLL_MS);
    document.addEventListener("visibilitychange", load);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
    };
  }, [pathname, isPublic, refresh]);

  const switchProfile = useCallback(
    async (profileId: string) => {
      const res = await fetch("/api/family/active-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId }),
      }).catch(() => null);
      if (!res?.ok) return false;
      await refresh();
      // Alle sider henter deres data på ny for den valgte profil.
      router.refresh();
      router.push("/");
      return true;
    },
    [refresh, router]
  );

  const value = useMemo(
    () => ({
      status: isPublic ? null : status,
      refresh,
      switchProfile,
      actingForOther: Boolean(!isPublic && status && status.activeProfile.id !== status.me.id),
    }),
    [status, isPublic, refresh, switchProfile]
  );

  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>;
}

export function useFamilyStatus() {
  return useContext(FamilyContext);
}
