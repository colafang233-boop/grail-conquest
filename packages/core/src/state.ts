import type { HexCoord } from "./hex";
import type { BattleId, FactionId, UnitId } from "./ids";

export type GameMode = "strategy" | "battle";
export type RegionId =
  | "tohsaka-residence"
  | "emiya-residence"
  | "school"
  | "shopping-street"
  | "fuyuki-bridge"
  | "harbor"
  | "church"
  | "ryudou-temple";
export type EncounterId = "school-night" | "bridge-duel" | "harbor-clash" | "ryudou-siege";
export type OperationPhase =
  | "dawn"
  | "planning"
  | "orders_locked"
  | "movement_resolution"
  | "encounter_resolution"
  | "night_settlement";
export type StrategicOrderType =
  | "move"
  | "investigate"
  | "defend_leyline"
  | "ambush"
  | "rest"
  | "prepare_workshop";
export type DetectionOutcome = "mutual" | "player_only" | "enemy_only" | "missed";
export type EncounterAdvantage = "player" | "enemy" | "none";
export type DiplomacyStatus = "neutral" | "truce" | "allied" | "hostile" | "betrayed";
export type StrategicFactionStatus = "active" | "withdrawn" | "defeated";
export type StrategicAiProfile = "player" | "honorable" | "hunter" | "fortifier";
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
  | "lancer_sweeping_strike"
  | "saber_invisible_air"
  | "saber_instinct"
  | "saber_mana_burst"
  | "caster_dragon_tooth"
  | "caster_boundary_field"
  | "caster_mana_drain"
  | "caster_workshop_reinforcement";

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

export interface StrategicOrder {
  readonly factionId: FactionId;
  readonly type: StrategicOrderType;
  readonly originRegionId: RegionId;
  readonly destinationRegionId: RegionId;
  readonly day: number;
}

export interface StrategicFactionResources {
  readonly manaReserve: number;
  readonly intelligence: number;
}

export interface StrategicFactionState {
  readonly id: FactionId;
  readonly name: string;
  readonly masterUnitId: UnitId;
  readonly servantUnitIds: readonly UnitId[];
  readonly regionId: RegionId;
  readonly knownRegionId?: RegionId;
  readonly exposure: number;
  readonly status: StrategicFactionStatus;
  readonly aiProfile: StrategicAiProfile;
  readonly knownIntel: readonly string[];
  readonly resources: StrategicFactionResources;
  readonly workshopLevel: number;
  readonly order?: StrategicOrder;
}

export interface DiplomacyRelation {
  readonly id: string;
  readonly firstFactionId: FactionId;
  readonly secondFactionId: FactionId;
  readonly status: DiplomacyStatus;
  readonly sharedDetection: boolean;
  readonly expiresDay?: number;
  readonly betrayalCount: number;
}

export interface AllianceOffer {
  readonly id: string;
  readonly fromFactionId: FactionId;
  readonly toFactionId: FactionId;
  readonly proposedStatus: "truce" | "allied";
  readonly durationDays: number;
  readonly expiresDay: number;
}

export interface ChurchBounty {
  readonly id: string;
  readonly targetFactionId: FactionId;
  readonly issuedDay: number;
  readonly reason: string;
  readonly intelligenceReward: number;
  readonly active: boolean;
}

export interface OperationDetection {
  readonly regionId: RegionId;
  readonly outcome: DetectionOutcome;
  readonly playerScore: number;
  readonly enemyScore: number;
  readonly playerRoll: number;
  readonly enemyRoll: number;
  readonly firstFactionId?: FactionId;
  readonly secondFactionId?: FactionId;
  readonly firstDetectedSecond?: boolean;
  readonly secondDetectedFirst?: boolean;
}

export interface StrategyEncounterQueueItem {
  readonly id: string;
  readonly encounterId: EncounterId;
  readonly regionId: RegionId;
  readonly detection: DetectionOutcome;
  readonly advantage: EncounterAdvantage;
  readonly mandatory: boolean;
  readonly participantFactionIds: readonly FactionId[];
  readonly hostilePairs: readonly string[];
  readonly advantagedFactionId?: FactionId;
}

export interface StrategyTimelineEntry {
  readonly id: string;
  readonly phase: OperationPhase;
  readonly message: string;
  readonly regionId?: RegionId;
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
  readonly encounterId?: EncounterId;
}

export interface StrategyState {
  readonly day: number;
  readonly actionPoints: number;
  readonly maxActionPoints: number;
  readonly currentRegionId: RegionId;
  readonly enemyRegionId: RegionId;
  readonly knownEnemyRegionId?: RegionId;
  readonly exposure: number;
  readonly enemyExposure: number;
  readonly objective: string;
  readonly regions: Readonly<Record<RegionId, StrategyRegionState>>;
  readonly phase: OperationPhase;
  readonly playerOrder?: StrategicOrder;
  readonly enemyOrder?: StrategicOrder;
  readonly factions: Readonly<Record<string, StrategicFactionState>>;
  readonly diplomacy: Readonly<Record<string, DiplomacyRelation>>;
  readonly allianceOffers: readonly AllianceOffer[];
  readonly churchBounty?: ChurchBounty;
  readonly encounterQueue: readonly StrategyEncounterQueueItem[];
  readonly activeEncounterId?: EncounterId;
  readonly activeParticipantFactionIds: readonly FactionId[];
  readonly resolutionTimeline: readonly StrategyTimelineEntry[];
  readonly lastDetection?: OperationDetection;
  readonly lastDetections: readonly OperationDetection[];
  readonly operationSeed: number;
  readonly workshopPrepared: boolean;
  readonly pendingEncounterId?: EncounterId;
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
  readonly deployed: boolean;
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
  readonly participatingFactionIds: readonly FactionId[];
  readonly tiles: Readonly<Record<string, HexTileState>>;
  readonly units: Readonly<Record<string, BattleUnitState>>;
  readonly contracts: Readonly<Record<string, ContractState>>;
}

export interface GameState {
  readonly schemaVersion: 4;
  readonly sequence: number;
  readonly mode: GameMode;
  readonly strategy: StrategyState;
  readonly scenario: ScenarioState;
  readonly battle: BattleState;
}
