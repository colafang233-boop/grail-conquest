import type { HexCoord } from "./hex";
import type { BattleId, UnitId } from "./ids";

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

export type DomainEvent =
  | UnitMovedEvent
  | AttackStartedEvent
  | MainActionSpentEvent
  | ReactionSpentEvent
  | DamageDealtEvent
  | UnitDefeatedEvent
  | BattleTurnAdvancedEvent;
