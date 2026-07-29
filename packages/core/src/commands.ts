import type { HexCoord } from "./hex";
import type { BattleId, UnitId } from "./ids";

export interface MoveBattleUnitCommand {
  readonly type: "battle.move_unit";
  readonly battleId: BattleId;
  readonly unitId: UnitId;
  readonly destination: HexCoord;
}

export interface AttackBattleUnitCommand {
  readonly type: "battle.attack_unit";
  readonly battleId: BattleId;
  readonly attackerId: UnitId;
  readonly targetId: UnitId;
}

export interface EndBattleTurnCommand {
  readonly type: "battle.end_turn";
  readonly battleId: BattleId;
  readonly unitId: UnitId;
}

export type GameCommand =
  | MoveBattleUnitCommand
  | AttackBattleUnitCommand
  | EndBattleTurnCommand;
