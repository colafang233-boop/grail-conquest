import type { HexCoord } from "./hex";
import type { BattleId, FactionId, UnitId } from "./ids";
import type { AbilityId, CommandSealEffect } from "./state";

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

export interface UseAbilityCommand {
  readonly type: "ability.use";
  readonly battleId: BattleId;
  readonly actorId: UnitId;
  readonly abilityId: AbilityId;
  readonly targetId?: UnitId;
}

export interface PrepareNoblePhantasmCommand {
  readonly type: "noble_phantasm.prepare";
  readonly battleId: BattleId;
  readonly servantId: UnitId;
  readonly targetId: UnitId;
}

export interface ReleaseNoblePhantasmCommand {
  readonly type: "noble_phantasm.release";
  readonly battleId: BattleId;
  readonly servantId: UnitId;
}

export interface TransferManaCommand {
  readonly type: "contract.transfer_mana";
  readonly battleId: BattleId;
  readonly factionId: FactionId;
}

export interface BeginScenarioEncounterCommand {
  readonly type: "scenario.begin_encounter";
}

export interface RetreatScenarioCommand {
  readonly type: "scenario.retreat";
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
  | UseAbilityCommand
  | PrepareNoblePhantasmCommand
  | ReleaseNoblePhantasmCommand
  | TransferManaCommand
  | UseCommandSealCommand
  | BeginScenarioEncounterCommand
  | RetreatScenarioCommand;
