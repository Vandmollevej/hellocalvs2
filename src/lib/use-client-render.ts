"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * Sand, når komponenten tegnes direkte i browseren (fx efter et klik i
 * bundmenuen), og falsk under serverens HTML og selve hydreringen. Bruges som
 * startværdi for tilstand fra localStorage: så kan en side tegne brugerens
 * gemte rækkefølge allerede i første billede uden hydreringsfejl, i stedet
 * for at tegne standarden og hoppe efter mount.
 */
export function useIsClientRender(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
