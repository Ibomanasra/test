"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => undefined;

/** true, sobald die Komponente im Browser hydratisiert ist (Server-Render: false). */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
