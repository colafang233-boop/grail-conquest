import type { HexCoord } from "./hex";
import type { BattleId, FactionId, UnitId } from "./ids";
import type { CommandSealEffect } from "./state";

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

export interface TransferManaCommand {
  readonly type: "contract.transfer_mana";
  readonly battleId: BattleId;
  readonly factionId: FactionId;
}

export interface UseCommandSealCommand {
  readonly type: "contract.use_command_seal";
  readonly battleId: BattleId;
  readonly factionId: FactionId;
  readonly effect: CommandSealEffect;
}

export type GameCommand =
  | MoveBattleUnitCommand
  | AttackBattleUnitCommand
  | EndBattleTurnCommand
  | TransferManaCommand
  | UseCommandSealCommand;
