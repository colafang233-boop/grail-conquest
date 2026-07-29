import type { HexCoord } from "./hex";
import type { BattleId, FactionId, UnitId } from "./ids";
import type {
  AbilityId,
  CommandSealEffect,
  IntelClue,
  ScenarioOutcome,
  ScenarioReport,
} from "./state";

export interface UnitMovedEvent {
  readonly type: "battle.unit_moved";
  readonly sequence: number;
  readonly battleId: BattleId;
  readonly unitId: UnitId;
  readonly from: HexCoord;
  readonly to: HexCoord;
  readonly path: readonly HexCoord[];
  readonly movementSpent: number;
}

export interface UnitDisplacedEvent {
  readonly type: "battle.unit_displaced";
  readonly sequence: number;
  readonly battleId: BattleId;
  readonly unitId: UnitId;
  readonly from: HexCoord;
  readonly to: HexCoord;
  readonly sourceId: UnitId;
}

export interface AttackStartedEvent {
  readonly type: "battle.attack_started";
  readonly sequence: number;
  readonly battleId: BattleId;
  readonly attackerId: UnitId;
  readonly targetId: UnitId;
  readonly kind: "normal" | "counter" | "ability" | "noble_phantasm";
}

export interface MainActionSpentEvent {
  readonly type: "battle.main_action_spent";
  readonly sequence: number;
  readonly battleId: BattleId;
  readonly unitId: UnitId;
}

export interface ReactionSpentEvent {
  readonly type: "battle.reaction_spent";
  readonly sequence: number;
  readonly battleId: BattleId;
  readonly unitId: UnitId;
}

export interface ManaSpentEvent {
  readonly type: "battle.mana_spent";
  readonly sequence: number;
  readonly battleId: BattleId;
  readonly unitId: UnitId;
  readonly amount: number;
  readonly reason: "ability" | "noble_phantasm";
}

export interface DamageDealtEvent {
  readonly type: "battle.damage_dealt";
  readonly sequence: number;
  readonly battleId: BattleId;
  readonly sourceId: UnitId;
  readonly targetId: UnitId;
  readonly amount: number;
  readonly kind: "normal" | "counter" | "ability" | "noble_phantasm";
}

export interface BarrierAbsorbedEvent {
  readonly type: "battle.barrier_absorbed";
  readonly sequence: number;
  readonly battleId: BattleId;
  readonly targetId: UnitId;
  readonly amount: number;
}

export interface UnitDefeatedEvent {
  readonly type: "battle.unit_defeated";
  readonly sequence: number;
  readonly battleId: BattleId;
  readonly unitId: UnitId;
  readonly defeatedBy: UnitId;
}

export interface BattleTurnAdvancedEvent {
  readonly type: "battle.turn_advanced";
  readonly sequence: number;
  readonly battleId: BattleId;
  readonly previousUnitId: UnitId;
  readonly activeUnitId: UnitId;
  readonly round: number;
}

export interface AbilityUsedEvent {
  readonly type: "ability.used";
  readonly sequence: number;
  readonly battleId: BattleId;
  readonly actorId: UnitId;
  readonly abilityId: AbilityId;
  readonly targetIds: readonly UnitId[];
}

export interface BarrierAppliedEvent {
  readonly type: "ability.barrier_applied";
  readonly sequence: number;
  readonly battleId: BattleId;
  readonly sourceId: UnitId;
  readonly targetId: UnitId;
  readonly amount: number;
}

export interface GuardSupportActivatedEvent {
  readonly type: "ability.guard_support_activated";
  readonly sequence: number;
  readonly battleId: BattleId;
  readonly servantId: UnitId;
  readonly guardBonus: number;
}

export interface BattleContinuationActivatedEvent {
  readonly type: "ability.battle_continuation_activated";
  readonly sequence: number;
  readonly battleId: BattleId;
  readonly servantId: UnitId;
}

export interface BattleContinuationTriggeredEvent {
  readonly type: "ability.battle_continuation_triggered";
  readonly sequence: number;
  readonly battleId: BattleId;
  readonly servantId: UnitId;
  readonly sourceId: UnitId;
}

export interface NoblePhantasmPreparationStartedEvent {
  readonly type: "noble_phantasm.preparation_started";
  readonly sequence: number;
  readonly battleId: BattleId;
  readonly servantId: UnitId;
  readonly definitionId: string;
  readonly targetId: UnitId;
  readonly requiredCharge: number;
  readonly interruptThreshold: number;
}

export interface NoblePhantasmChargeAdvancedEvent {
  readonly type: "noble_phantasm.charge_advanced";
  readonly sequence: number;
  readonly battleId: BattleId;
  readonly servantId: UnitId;
  readonly charge: number;
}

export interface NoblePhantasmReadyEvent {
  readonly type: "noble_phantasm.ready";
  readonly sequence: number;
  readonly battleId: BattleId;
  readonly servantId: UnitId;
}

export interface NoblePhantasmReleasedEvent {
  readonly type: "noble_phantasm.released";
  readonly sequence: number;
  readonly battleId: BattleId;
  readonly servantId: UnitId;
  readonly definitionId: string;
  readonly targetId: UnitId;
}

export interface NoblePhantasmInterruptedEvent {
  readonly type: "noble_phantasm.interrupted";
  readonly sequence: number;
  readonly battleId: BattleId;
  readonly servantId: UnitId;
  readonly sourceId: UnitId;
  readonly reason: "damage" | "displacement" | "command_seal";
}

export interface NoblePhantasmCooldownChangedEvent {
  readonly type: "noble_phantasm.cooldown_changed";
  readonly sequence: number;
  readonly battleId: BattleId;
  readonly servantId: UnitId;
  readonly remaining: number;
}

export interface MasterGuardedEvent {
  readonly type: "contract.master_guarded";
  readonly sequence: number;
  readonly battleId: BattleId;
  readonly masterId: UnitId;
  readonly guardianId: UnitId;
  readonly attackerId: UnitId;
}

export interface ManaTransferredEvent {
  readonly type: "contract.mana_transferred";
  readonly sequence: number;
  readonly battleId: BattleId;
  readonly factionId: FactionId;
  readonly masterId: UnitId;
  readonly servantId: UnitId;
  readonly amount: number;
}

export interface ServantUpkeepPaidEvent {
  readonly type: "contract.servant_upkeep_paid";
  readonly sequence: number;
  readonly battleId: BattleId;
  readonly factionId: FactionId;
  readonly servantId: UnitId;
  readonly amount: number;
  readonly required: number;
}

export interface LowManaStateChangedEvent {
  readonly type: "contract.low_mana_changed";
  readonly sequence: number;
  readonly battleId: BattleId;
  readonly servantId: UnitId;
  readonly lowMana: boolean;
}

export interface ContractStabilityChangedEvent {
  readonly type: "contract.stability_changed";
  readonly sequence: number;
  readonly battleId: BattleId;
  readonly factionId: FactionId;
  readonly stability: number;
}

export interface CommandSealUsedEvent {
  readonly type: "contract.command_seal_used";
  readonly sequence: number;
  readonly battleId: BattleId;
  readonly factionId: FactionId;
  readonly effect: CommandSealEffect;
}

export interface ServantRecalledEvent {
  readonly type: "contract.servant_recalled";
  readonly sequence: number;
  readonly battleId: BattleId;
  readonly servantId: UnitId;
  readonly from: HexCoord;
  readonly to: HexCoord;
}

export interface ExtraTurnGrantedEvent {
  readonly type: "contract.extra_turn_granted";
  readonly sequence: number;
  readonly battleId: BattleId;
  readonly servantId: UnitId;
}

export interface ManaRestoredEvent {
  readonly type: "contract.mana_restored";
  readonly sequence: number;
  readonly battleId: BattleId;
  readonly servantId: UnitId;
  readonly amount: number;
}

export interface DeathWardActivatedEvent {
  readonly type: "contract.death_ward_activated";
  readonly sequence: number;
  readonly battleId: BattleId;
  readonly servantId: UnitId;
}

export interface DeathRejectedEvent {
  readonly type: "contract.death_rejected";
  readonly sequence: number;
  readonly battleId: BattleId;
  readonly servantId: UnitId;
  readonly sourceId: UnitId;
}

export interface ScenarioEncounterStartedEvent {
  readonly type: "scenario.encounter_started";
  readonly sequence: number;
  readonly scenarioId: "school-night";
}

export interface ScenarioClueDiscoveredEvent {
  readonly type: "scenario.clue_discovered";
  readonly sequence: number;
  readonly scenarioId: "school-night";
  readonly clue: IntelClue;
}

export interface NoblePhantasmWarningEvent {
  readonly type: "scenario.noble_phantasm_warning";
  readonly sequence: number;
  readonly scenarioId: "school-night";
  readonly enemyId: UnitId;
  readonly message: string;
}

export interface ScenarioCompletedEvent {
  readonly type: "scenario.completed";
  readonly sequence: number;
  readonly scenarioId: "school-night";
  readonly outcome: ScenarioOutcome;
  readonly report: ScenarioReport;
}

export type DomainEvent =
  | UnitMovedEvent
  | UnitDisplacedEvent
  | AttackStartedEvent
  | MainActionSpentEvent
  | ReactionSpentEvent
  | ManaSpentEvent
  | DamageDealtEvent
  | BarrierAbsorbedEvent
  | UnitDefeatedEvent
  | BattleTurnAdvancedEvent
  | AbilityUsedEvent
  | BarrierAppliedEvent
  | GuardSupportActivatedEvent
  | BattleContinuationActivatedEvent
  | BattleContinuationTriggeredEvent
  | NoblePhantasmPreparationStartedEvent
  | NoblePhantasmChargeAdvancedEvent
  | NoblePhantasmReadyEvent
  | NoblePhantasmReleasedEvent
  | NoblePhantasmInterruptedEvent
  | NoblePhantasmCooldownChangedEvent
  | MasterGuardedEvent
  | ManaTransferredEvent
  | ServantUpkeepPaidEvent
  | LowManaStateChangedEvent
  | ContractStabilityChangedEvent
  | CommandSealUsedEvent
  | ServantRecalledEvent
  | ExtraTurnGrantedEvent
  | ManaRestoredEvent
  | DeathWardActivatedEvent
  | DeathRejectedEvent
  | ScenarioEncounterStartedEvent
  | ScenarioClueDiscoveredEvent
  | NoblePhantasmWarningEvent
  | ScenarioCompletedEvent;
