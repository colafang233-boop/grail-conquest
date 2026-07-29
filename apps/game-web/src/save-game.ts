import type { DomainEvent, GameState } from "@grail/core";
import { gameEngine } from "./game-engine";

const SAVE_KEY = "grail-conquest:school-night:v1";

interface StoredGame {
  readonly formatVersion: 1;
  readonly savedAt: string;
  readonly state: GameState;
  readonly eventLog: readonly DomainEvent[];
}

export function hasSavedGame(): boolean {
  return window.localStorage.getItem(SAVE_KEY) !== null;
}

export function saveCurrentGame(): string {
  const snapshot = gameEngine.getSnapshot();
  const stored: StoredGame = {
    formatVersion: 1,
    savedAt: new Date().toISOString(),
    state: snapshot.state,
    eventLog: snapshot.eventLog,
  };
  window.localStorage.setItem(SAVE_KEY, JSON.stringify(stored));
  return stored.savedAt;
}

export function loadSavedGame(): string | undefined {
  const raw = window.localStorage.getItem(SAVE_KEY);
  if (!raw) return undefined;
  const parsed: unknown = JSON.parse(raw);
  if (!isStoredGame(parsed)) throw new Error("存档格式无效或版本不兼容");
  gameEngine.restore(parsed.state, parsed.eventLog);
  return parsed.savedAt;
}

function isStoredGame(value: unknown): value is StoredGame {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StoredGame>;
  return candidate.formatVersion === 1
    && typeof candidate.savedAt === "string"
    && Boolean(candidate.state)
    && candidate.state?.schemaVersion === 1
    && candidate.state?.scenario?.id === "school-night"
    && Array.isArray(candidate.eventLog);
}
