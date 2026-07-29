import { useSyncExternalStore } from "react";
import { gameEngine } from "../game-engine";

export function useGameSnapshot() {
  return useSyncExternalStore(
    gameEngine.subscribe,
    gameEngine.getSnapshot,
    gameEngine.getSnapshot,
  );
}
