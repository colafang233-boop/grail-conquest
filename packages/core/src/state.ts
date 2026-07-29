import type { HexCoord } from "./hex";
import type { BattleId, FactionId, UnitId } from "./ids";

export type GameMode = "strategy" | "battle";
export type RegionId =
  | "tohsaka-residence"
  | "school"
  | "shopping-street"
  | "fuyuki-bridge"
  | "harbor"
  | "church";
export type UnitRole = "servant" | "master" | "familiar";
export type CommandSealEffect = "recall" | "extra_turn" | "mana_infusion" | "reject_death";
export type ScenarioPhase = "investigation" | "encounter" | "noble_phantasm_warning" | "completed";
export type ScenarioOutcome = "retreated_with_intel" | "enemy_defeated" | "master_defeated" | "servant_defeated";

export type AbilityId =
  | "archer_projected_shot"
  | "archer_projected_shield"
  | "archer_guard_support"
  | "lancer_high_speed_thrust"
  | "lancer_battle_continuation"
  | "lancer_sweeping_strike";

export type NoblePhantasmPhase =
  | "hidden"
  | "preparing"
  | "ready"
  | "released"
  | "interrupted"
  | "cooldown";

export interface NoblePhantasmState {
  readonly definitionId: string;
  readonly phase: NoblePhantasmPhase;
  readonly charge: number;
  readonly requiredCharge: number;
  readonly cooldownRemaining: number;
  readonly interruptThreshold: number;
  readonly targetId?: UnitId;
}

export interface IntelClue {
  readonly id: string;
  readonly category: "class" | "weapon" | "combat_style" | "origin" | "noble_phantasm";
  readonly label: string;
  readonly confidence: number;
  readonly source: string;
  readonly discoveredAtSequence: number;
}

export interface IdentityCandidate {
  readonly id: string;
  readonly name: string;
  readonly confidence: number;
}

export interface ScenarioReport {
  readonly title: string;
  readonly summary: string;
  readonly candidates: readonly IdentityCandidate[];
  readonly unlockedTactics: readonly string[];
}

export interface ScenarioState {
  readonly id: "school-night";
  readonly phase: ScenarioPhase;
  readonly objective: string;
  readonly warningRound: number;
  readonly clues: readonly IntelClue[];
  readonly outcome?: ScenarioOutcome;
  readonly report?: ScenarioReport;
}

export interface StrategyRegionState {
  readonly id: RegionId;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly connections: readonly RegionId[];
  readonly leylineStrength: number;
  readonly discovered: boolean;
  readonly investigated: boolean;
  readonly controlledBy?: FactionId;
  readonly encounterId?: "school-night";
}

export interface StrategyState {
  readonly day: number;
  readonly actionPoints: number;
  readonly maxActionPoints: number;
  readonly currentRegionId: RegionId;
  readonly exposure: number;
  readonly objective: string;
  readonly regions: Readonly<Record<RegionId, StrategyRegionState>>;
  readonly pendingEncounterId?: "school-night";
  readonly completedEncounterIds: readonly string[];
  readonly lastReport?: ScenarioReport;
}

export interface HexTileState {
  readonly coord: HexCoord;
  readonly movementCost: number;
  readonly blocked: boolean;
  readonly terrain: "floor" | "wall" | "rubble";
}

export interface BattleUnitState {
  readonly id: UnitId;
  readonly factionId: FactionId;
  readonly role: UnitRole;
  readonly name: string;
  readonly position: HexCoord;
  readonly health: number;
  readonly maxHealth: number;
  readonly mana: number;
  readonly maxMana: number;
  readonly movement: number;
  readonly remainingMovement: number;
  readonly attackPower: number;
  readonly defense: number;
  readonly attackRange: number;
  readonly counterRange: number;
  readonly mainActionAvailable: boolean;
  readonly reactionAvailable: boolean;
  readonly defeated: boolean;
  readonly lowMana: boolean;
  readonly deathWardActive: boolean;
  readonly abilityIds: readonly AbilityId[];
  readonly barrier: number;
  readonly guardBonus: number;
  readonly battleContinuationActive: boolean;
  readonly noblePhantasm?: NoblePhantasmState;
}

export interface ContractState {
  readonly factionId: FactionId;
  readonly masterId: UnitId;
  readonly servantId: UnitId;
  readonly commandSeals: number;
  readonly transferRange: number;
  readonly transferAmount: number;
  readonly guardRange: number;
  readonly upkeep: number;
  readonly trust: number;
  readonly stability: number;
}

export interface BattleState {
  readonly id: BattleId;
  readonly round: number;
  readonly activeUnitId: UnitId;
  readonly initiative: readonly UnitId[];
  readonly tiles: Readonly<Record<string, HexTileState>>;
  readonly units: Readonly<Record<string, BattleUnitState>>;
  readonly contracts: Readonly<Record<string, ContractState>>;
}

export interface GameState {
  readonly schemaVersion: 2;
  readonly sequence: number;
  readonly mode: GameMode;
  readonly strategy: StrategyState;
  readonly scenario: ScenarioState;
  readonly battle: BattleState;
}
