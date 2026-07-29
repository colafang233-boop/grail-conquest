import type { HexCoord } from "./hex";
import type { BattleId, FactionId, UnitId } from "./ids";
import type { CommandSealEffect } from "./state";

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

export interface AttackStartedEvent {
  readonly type: "battle.attack_started";
  readonly sequence: number;
  readonly battleId: BattleId;
  readonly attackerId: UnitId;
  readonly targetId: UnitId;
  readonly kind: "normal" | "counter";
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

export interface DamageDealtEvent {
  readonly type: "battle.damage_dealt";
  readonly sequence: number;
  readonly battleId: BattleId;
  readonly sourceId: UnitId;
  readonly targetId: UnitId;
  readonly amount: number;
  readonly kind: "normal" | "counter";
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

export type DomainEvent =
  | UnitMovedEvent
  | AttackStartedEvent
  | MainActionSpentEvent
  | ReactionSpentEvent
  | DamageDealtEvent
  | UnitDefeatedEvent
  | BattleTurnAdvancedEvent
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
  | DeathRejectedEvent;
