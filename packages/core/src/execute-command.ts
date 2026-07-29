import type { EndBattleTurnCommand, GameCommand, MoveBattleUnitCommand } from "./commands";
import type { DomainError } from "./errors";
import type { DomainEvent } from "./events";
import { hexEquals, hexKey } from "./hex";
import { findReachableHexes } from "./pathfinding";
import type { GameState } from "./state";

export type CommandResult =
  | { readonly ok: true; readonly events: readonly DomainEvent[] }
  | { readonly ok: false; readonly error: DomainError };

export function executeCommand(state: GameState, command: GameCommand): CommandResult {
  switch (command.type) {
    case "battle.move_unit":
      return executeMoveUnit(state, command);
    case "battle.end_turn":
      return executeEndTurn(state, command);
    default:
      return assertNever(command);
  }
}

function executeMoveUnit(
  state: GameState,
  command: MoveBattleUnitCommand,
): CommandResult {
  const battle = state.battle;

  if (battle.id !== command.battleId) {
    return failure("battle_not_found", `Battle ${command.battleId} does not exist`);
  }

  const unit = battle.units[command.unitId];

  if (!unit) {
    return failure("unit_not_found", `Unit ${command.unitId} does not exist`);
  }

  if (battle.activeUnitId !== unit.id) {
    return failure("not_active_unit", `${unit.name} is not the active unit`);
  }

  if (hexEquals(unit.position, command.destination)) {
    return failure("same_position", "Unit is already on the destination tile");
  }

  if (!battle.tiles[hexKey(command.destination)]) {
    return failure("tile_not_found", "Destination is outside the battlefield");
  }

  const reachable = findReachableHexes(battle, unit.id);
  const route = reachable[hexKey(command.destination)];

  if (!route) {
    return failure("destination_unreachable", "No legal route reaches that tile");
  }

  return {
    ok: true,
    events: [
      {
        type: "battle.unit_moved",
        sequence: state.sequence + 1,
        battleId: battle.id,
        unitId: unit.id,
        from: unit.position,
        to: command.destination,
        path: route.path,
        movementSpent: route.cost,
      },
    ],
  };
}

function executeEndTurn(
  state: GameState,
  command: EndBattleTurnCommand,
): CommandResult {
  const battle = state.battle;

  if (battle.id !== command.battleId) {
    return failure("battle_not_found", `Battle ${command.battleId} does not exist`);
  }

  const unit = battle.units[command.unitId];

  if (!unit) {
    return failure("unit_not_found", `Unit ${command.unitId} does not exist`);
  }

  if (battle.activeUnitId !== command.unitId) {
    return failure("not_active_unit", `${unit.name} is not the active unit`);
  }

  const currentIndex = battle.initiative.indexOf(command.unitId);
  if (currentIndex < 0 || battle.initiative.length === 0) {
    return failure("initiative_invalid", "The active unit is missing from initiative");
  }

  const nextIndex = (currentIndex + 1) % battle.initiative.length;
  const nextUnitId = battle.initiative[nextIndex];

  if (!nextUnitId) {
    return failure("initiative_invalid", "No next unit exists in initiative");
  }

  return {
    ok: true,
    events: [
      {
        type: "battle.turn_advanced",
        sequence: state.sequence + 1,
        battleId: battle.id,
        previousUnitId: command.unitId,
        activeUnitId: nextUnitId,
        round: nextIndex === 0 ? battle.round + 1 : battle.round,
      },
    ],
  };
}

function failure(code: DomainError["code"], message: string): CommandResult {
  return { ok: false, error: { code, message } };
}

function assertNever(value: never): never {
  throw new Error(`Unhandled command: ${JSON.stringify(value)}`);
}
