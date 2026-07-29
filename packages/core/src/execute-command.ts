import type {
  AttackBattleUnitCommand,
  EndBattleTurnCommand,
  GameCommand,
  MoveBattleUnitCommand,
} from "./commands";
import { calculateDamage, canCounterattack, isAttackInRange } from "./combat";
import type { DomainError } from "./errors";
import type { DomainEvent } from "./events";
import { hexEquals, hexKey } from "./hex";
import { findReachableHexes } from "./pathfinding";
import type { BattleState, GameState } from "./state";
import type { UnitId } from "./ids";

export type CommandResult =
  | { readonly ok: true; readonly events: readonly DomainEvent[] }
  | { readonly ok: false; readonly error: DomainError };

export function executeCommand(state: GameState, command: GameCommand): CommandResult {
  switch (command.type) {
    case "battle.move_unit":
      return executeMoveUnit(state, command);
    case "battle.attack_unit":
      return executeAttackUnit(state, command);
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

  if (unit.defeated) {
    return failure("attacker_defeated", `${unit.name} has been defeated`);
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

function executeAttackUnit(
  state: GameState,
  command: AttackBattleUnitCommand,
): CommandResult {
  const battle = state.battle;

  if (battle.id !== command.battleId) {
    return failure("battle_not_found", `Battle ${command.battleId} does not exist`);
  }

  const attacker = battle.units[command.attackerId];
  const target = battle.units[command.targetId];

  if (!attacker) {
    return failure("unit_not_found", `Attacker ${command.attackerId} does not exist`);
  }

  if (!target) {
    return failure("target_not_found", `Target ${command.targetId} does not exist`);
  }

  if (battle.activeUnitId !== attacker.id) {
    return failure("not_active_unit", `${attacker.name} is not the active unit`);
  }

  if (attacker.defeated) {
    return failure("attacker_defeated", `${attacker.name} has been defeated`);
  }

  if (target.defeated) {
    return failure("target_defeated", `${target.name} has already been defeated`);
  }

  if (attacker.factionId === target.factionId) {
    return failure("friendly_target", "Friendly units cannot be attacked");
  }

  if (!attacker.mainActionAvailable) {
    return failure("main_action_unavailable", `${attacker.name} has spent the main action`);
  }

  if (!isAttackInRange(attacker, target)) {
    return failure("attack_out_of_range", `${target.name} is outside attack range`);
  }

  let sequence = state.sequence;
  const nextSequence = () => {
    sequence += 1;
    return sequence;
  };
  const events: DomainEvent[] = [];
  const damage = calculateDamage(attacker, target);

  events.push(
    {
      type: "battle.attack_started",
      sequence: nextSequence(),
      battleId: battle.id,
      attackerId: attacker.id,
      targetId: target.id,
      kind: "normal",
    },
    {
      type: "battle.main_action_spent",
      sequence: nextSequence(),
      battleId: battle.id,
      unitId: attacker.id,
    },
    {
      type: "battle.damage_dealt",
      sequence: nextSequence(),
      battleId: battle.id,
      sourceId: attacker.id,
      targetId: target.id,
      amount: damage,
      kind: "normal",
    },
  );

  if (target.health <= damage) {
    events.push({
      type: "battle.unit_defeated",
      sequence: nextSequence(),
      battleId: battle.id,
      unitId: target.id,
      defeatedBy: attacker.id,
    });
    return { ok: true, events };
  }

  if (canCounterattack(target, attacker)) {
    const counterDamage = calculateDamage(target, attacker);

    events.push(
      {
        type: "battle.attack_started",
        sequence: nextSequence(),
        battleId: battle.id,
        attackerId: target.id,
        targetId: attacker.id,
        kind: "counter",
      },
      {
        type: "battle.reaction_spent",
        sequence: nextSequence(),
        battleId: battle.id,
        unitId: target.id,
      },
      {
        type: "battle.damage_dealt",
        sequence: nextSequence(),
        battleId: battle.id,
        sourceId: target.id,
        targetId: attacker.id,
        amount: counterDamage,
        kind: "counter",
      },
    );

    if (attacker.health <= counterDamage) {
      events.push({
        type: "battle.unit_defeated",
        sequence: nextSequence(),
        battleId: battle.id,
        unitId: attacker.id,
        defeatedBy: target.id,
      });
    }
  }

  return { ok: true, events };
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

  const next = findNextLivingUnit(battle, command.unitId);
  if (!next) {
    return failure("initiative_invalid", "No living unit can take the next turn");
  }

  return {
    ok: true,
    events: [
      {
        type: "battle.turn_advanced",
        sequence: state.sequence + 1,
        battleId: battle.id,
        previousUnitId: command.unitId,
        activeUnitId: next.unitId,
        round: battle.round + next.roundsAdvanced,
      },
    ],
  };
}

function findNextLivingUnit(
  battle: BattleState,
  currentUnitId: UnitId,
): { readonly unitId: UnitId; readonly roundsAdvanced: number } | undefined {
  const currentIndex = battle.initiative.indexOf(currentUnitId);
  if (currentIndex < 0 || battle.initiative.length === 0) return undefined;

  for (let offset = 1; offset <= battle.initiative.length; offset += 1) {
    const rawIndex = currentIndex + offset;
    const index = rawIndex % battle.initiative.length;
    const candidateId = battle.initiative[index];
    const candidate = candidateId ? battle.units[candidateId] : undefined;

    if (candidate && !candidate.defeated) {
      return {
        unitId: candidate.id,
        roundsAdvanced: Math.floor(rawIndex / battle.initiative.length),
      };
    }
  }

  return undefined;
}

function failure(code: DomainError["code"], message: string): CommandResult {
  return { ok: false, error: { code, message } };
}

function assertNever(value: never): never {
  throw new Error(`Unhandled command: ${JSON.stringify(value)}`);
}
