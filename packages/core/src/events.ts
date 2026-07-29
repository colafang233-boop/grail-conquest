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

export interface BattleTurnAdvancedEvent {
  readonly type: "battle.turn_advanced";
  readonly sequence: number;
  readonly battleId: BattleId;
  readonly previousUnitId: UnitId;
  readonly activeUnitId: UnitId;
  readonly round: number;
}

export type DomainEvent = UnitMovedEvent | BattleTurnAdvancedEvent;
