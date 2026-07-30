import {
  createInitialCampaignState,
  createSchoolBattleState,
  type AllDomainEvent,
  type BattleUnitState,
  type GameState,
} from "@grail/core";
import { gameEngine } from "./game-engine";

const SAVE_KEY = "grail-conquest:fuyuki-war:v5";
const LEGACY_V4_KEY = "grail-conquest:fuyuki-war:v4";
const LEGACY_V3_KEY = "grail-conquest:fuyuki-war:v3";
const LEGACY_V2_KEY = "grail-conquest:fuyuki-war:v2";

interface StoredGame {
  readonly formatVersion: 5;
  readonly savedAt: string;
  readonly initialState: GameState;
  readonly state: GameState;
  readonly eventLog: readonly AllDomainEvent[];
}

interface LegacyStoredGame {
  readonly formatVersion: 2 | 3 | 4;
  readonly savedAt: string;
  readonly state: {
    readonly schemaVersion: 2 | 3 | 4;
    readonly sequence: number;
    readonly mode: "strategy" | "battle";
    readonly strategy: Record<string, unknown>;
    readonly scenario: GameState["scenario"];
    readonly battle: Record<string, unknown>;
  };
  readonly eventLog: readonly unknown[];
}

export function hasSavedGame(): boolean {
  return [SAVE_KEY, LEGACY_V4_KEY, LEGACY_V3_KEY, LEGACY_V2_KEY]
    .some(key => window.localStorage.getItem(key) !== null);
}

export function saveCurrentGame(): string {
  const snapshot = gameEngine.getSnapshot();
  const stored: StoredGame = {
    formatVersion: 5,
    savedAt: new Date().toISOString(),
    initialState: snapshot.initialState,
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
    gameEngine.restore(parsed.state, parsed.eventLog, parsed.initialState);
    return parsed.savedAt;
  }

  for (const key of [LEGACY_V4_KEY, LEGACY_V3_KEY, LEGACY_V2_KEY]) {
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;
    const parsed: unknown = JSON.parse(raw);
    if (!isLegacyStoredGame(parsed)) throw new Error("旧存档格式无效，无法迁移");
    const migrated = migrateLegacyState(parsed.state);
    gameEngine.restore(migrated, [], migrated);
    return parsed.savedAt;
  }
  return undefined;
}

function migrateLegacyState(legacy: LegacyStoredGame["state"]): GameState {
  const defaults = createSchoolBattleState();
  const legacyStrategy = legacy.strategy as Partial<GameState["strategy"]>;
  const legacyBattle = legacy.battle as Partial<GameState["battle"]> & {
    readonly units?: Readonly<Record<string, Partial<BattleUnitState>>>;
  };
  const units: Record<string, BattleUnitState> = { ...defaults.battle.units };
  for (const [unitId, legacyUnit] of Object.entries(legacyBattle.units ?? {})) {
    const fallback = defaults.battle.units[unitId];
    if (!fallback) continue;
    units[unitId] = {
      ...fallback,
      ...legacyUnit,
      deployed: legacyUnit.deployed ?? (unitId === "archer" || unitId === "rin" || unitId === "lancer"),
    };
  }

  return {
    schemaVersion: 5,
    sequence: legacy.sequence,
    mode: legacy.mode,
    campaign: createInitialCampaignState(true),
    scenario: legacy.scenario,
    battle: {
      ...defaults.battle,
      ...legacyBattle,
      units,
      participatingFactionIds: legacyBattle.participatingFactionIds ?? defaults.battle.participatingFactionIds,
    },
    strategy: {
      ...defaults.strategy,
      ...legacyStrategy,
      phase: "planning",
      factions: defaults.strategy.factions,
      diplomacy: defaults.strategy.diplomacy,
      allianceOffers: [],
      encounterQueue: [],
      activeParticipantFactionIds: [],
      lastDetections: [],
      resolutionTimeline: [],
      operationSeed: legacyStrategy.operationSeed ?? defaults.strategy.operationSeed,
      workshopPrepared: false,
    },
  };
}

function isStoredGame(value: unknown): value is StoredGame {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StoredGame>;
  return candidate.formatVersion === 5 &&
    typeof candidate.savedAt === "string" &&
    Boolean(candidate.initialState) && candidate.initialState?.schemaVersion === 5 &&
    Boolean(candidate.state) && candidate.state?.schemaVersion === 5 &&
    candidate.state?.scenario?.id === "school-night" &&
    Boolean(candidate.state?.strategy) &&
    Array.isArray(candidate.eventLog);
}

function isLegacyStoredGame(value: unknown): value is LegacyStoredGame {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<LegacyStoredGame>;
  return (candidate.formatVersion === 2 || candidate.formatVersion === 3 || candidate.formatVersion === 4) &&
    typeof candidate.savedAt === "string" && Boolean(candidate.state) &&
    (candidate.state?.schemaVersion === 2 || candidate.state?.schemaVersion === 3 || candidate.state?.schemaVersion === 4) &&
    candidate.state?.scenario?.id === "school-night" && Boolean(candidate.state?.strategy) && Array.isArray(candidate.eventLog);
}
