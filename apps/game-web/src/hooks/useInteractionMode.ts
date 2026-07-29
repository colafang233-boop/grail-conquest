import { useSyncExternalStore } from "react";
import { interactionStore } from "../interaction-store";

export function useInteractionMode() {
  return useSyncExternalStore(
    interactionStore.subscribe,
    interactionStore.getSnapshot,
    interactionStore.getSnapshot,
  );
}
