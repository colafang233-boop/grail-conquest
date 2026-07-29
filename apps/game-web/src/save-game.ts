import { createSchoolBattleState, type AllDomainEvent, type GameState } from "@grail/core";
import { gameEngine } from "./game-engine";

const SAVE_KEY = "grail-conquest:fuyuki-war:v3";
const LEGACY_SAVE_KEY = "grail-conquest:fuyuki-war:v2";

interface StoredGame {
  readonly formatVersion: 3;
  readonly savedAt: string;
  readonly state: GameState;
  readonly eventLog: readonly AllDomainEvent[];
}

interface LegacyStoredGame {
  readonly formatVersion: 2;
  readonly savedAt: string;
  readonly state: {
    readonly schemaVersion: 2;
    readonly sequence: number;
    readonly mode: GameState["mode"];
    readonly strategy: Record<string, unknown>;
    readonly scenario: GameState["scenario"];
    readonly battle: GameState["battle"];
  };
  readonly eventLog: readonly AllDomainEvent[];
}

export function hasSavedGame(): boolean {
  return window.localStorage.getItem(SAVE_KEY) !== null ||
    window.localStorage.getItem(LEGACY_SAVE_KEY) !== null;
}

export function saveCurrentGame(): string {
  const snapshot = gameEngine.getSnapshot();
  const stored: StoredGame = {
    formatVersion: 3,
    savedAt: new Date().toISOString(),
    state: snapshot.state,
    eventLog: snapshot.eventLog,
  };
  window.localStorage.setItem(SAVE_KEY, JSON.stringify(stored));
  return stored.savedAt;
}

export function loadSavedGame(): string | undefined {
  const currentRaw = window.localStorage.getItem(SAVE_KEY);
  if (currentRaw) {
    const parsed: unknown = JSON.parse(currentRaw);
    if (!isStoredGame(parsed)) throw new Error("存档格式无效或版本不兼容");
    gameEngine.restore(parsed.state, parsed.eventLog);
    return parsed.savedAt;
  }

  const legacyRaw = window.localStorage.getItem(LEGACY_SAVE_KEY);
  if (!legacyRaw) return undefined;
  const parsed: unknown = JSON.parse(legacyRaw);
  if (!isLegacyStoredGame(parsed)) throw new Error("旧存档格式无效，无法迁移");
  const migrated = migrateLegacyState(parsed.state);
  gameEngine.restore(migrated, parsed.eventLog);
  return parsed.savedAt;
}

function migrateLegacyState(legacy: LegacyStoredGame["state"]): GameState {
  const defaults = createSchoolBattleState();
  const legacyStrategy = legacy.strategy as Partial<GameState["strategy"]>;
  return {
    schemaVersion: 3,
    sequence: legacy.sequence,
    mode: legacy.mode,
    scenario: legacy.scenario,
    battle: legacy.battle,
    strategy: {
      ...defaults.strategy,
      ...legacyStrategy,
      phase: "planning",
      enemyRegionId: "fuyuki-bridge",
      enemyExposure: 25,
      encounterQueue: [],
      resolutionTimeline: [],
      operationSeed: defaults.strategy.operationSeed,
      workshopPrepared: false,
    },
  };
}

function isStoredGame(value: unknown): value is StoredGame {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StoredGame>;
  return candidate.formatVersion === 3
    && typeof candidate.savedAt === "string"
    && Boolean(candidate.state)
    && candidate.state?.schemaVersion === 3
    && candidate.state?.scenario?.id === "school-night"
    && Boolean(candidate.state?.strategy)
    && Array.isArray(candidate.eventLog);
}

function isLegacyStoredGame(value: unknown): value is LegacyStoredGame {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<LegacyStoredGame>;
  return candidate.formatVersion === 2
    && typeof candidate.savedAt === "string"
    && Boolean(candidate.state)
    && candidate.state?.schemaVersion === 2
    && candidate.state?.scenario?.id === "school-night"
    && Boolean(candidate.state?.strategy)
    && Array.isArray(candidate.eventLog);
}
