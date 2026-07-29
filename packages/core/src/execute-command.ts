import type {
  AttackBattleUnitCommand,
  BeginScenarioEncounterCommand,
  EndBattleTurnCommand,
  GameCommand,
  MoveBattleUnitCommand,
  RetreatScenarioCommand,
  TransferManaCommand,
  UseCommandSealCommand,
} from "./commands";
import { calculateDamage, canCounterattack, isAttackInRange } from "./combat";
import {
  findGuardingServant,
  findRecallDestination,
  getContractByFaction,
  isLowMana,
} from "./contract";
import type { DomainError } from "./errors";
import type { DomainEvent } from "./events";
import { hexDistance, hexEquals, hexKey } from "./hex";
import type { FactionId, UnitId } from "./ids";
import { findReachableHexes } from "./pathfinding";
import { buildScenarioReport } from "./scenario";
import type { BattleState, BattleUnitState, ContractState, GameState } from "./state";

export type CommandResult =
  | { readonly ok: true; readonly events: readonly DomainEvent[] }
  | { readonly ok: false; readonly error: DomainError };

export function executeCommand(state: GameState, command: GameCommand): CommandResult {
  if (isTacticalCommand(command)) {
    if (state.scenario.phase === "investigation") {
      return failure("scenario_not_active", "Complete the investigation before issuing battle orders");
    }
    if (state.scenario.phase === "completed") {
      return failure("scenario_completed", "The school-night scenario has already ended");
    }
  }

  switch (command.type) {
    case "battle.move_unit":
      return executeMoveUnit(state, command);
    case "battle.attack_unit":
      return executeAttackUnit(state, command);
    case "battle.end_turn":
      return executeEndTurn(state, command);
    case "contract.transfer_mana":
      return executeTransferMana(state, command);
    case "contract.use_command_seal":
      return executeUseCommandSeal(state, command);
    case "scenario.begin_encounter":
      return executeBeginScenarioEncounter(state, command);
    case "scenario.retreat":
      return executeScenarioRetreat(state, command);
    default:
      return assertNever(command);
  }
}

function isTacticalCommand(command: GameCommand): boolean {
  return command.type.startsWith("battle.") || command.type.startsWith("contract.");
}

function executeBeginScenarioEncounter(
  state: GameState,
  _command: BeginScenarioEncounterCommand,
): CommandResult {
  if (state.scenario.phase !== "investigation") {
    return failure("scenario_already_started", "The school-night encounter has already started");
  }

  return {
    ok: true,
    events: [{
      type: "scenario.encounter_started",
      sequence: state.sequence + 1,
      scenarioId: state.scenario.id,
    }],
  };
}

function executeScenarioRetreat(
  state: GameState,
  _command: RetreatScenarioCommand,
): CommandResult {
  if (state.scenario.phase === "completed") {
    return failure("scenario_completed", "The school-night scenario has already ended");
  }
  if (state.scenario.phase !== "noble_phantasm_warning") {
    return failure("retreat_unavailable", "A tactical retreat is not available yet");
  }

  const outcome = "retreated_with_intel" as const;
  return {
    ok: true,
    events: [{
      type: "scenario.completed",
      sequence: state.sequence + 1,
      scenarioId: state.scenario.id,
      outcome,
      report: buildScenarioReport(outcome, state.scenario.clues),
    }],
  };
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
  if (!unit) return failure("unit_not_found", `Unit ${command.unitId} does not exist`);
  if (battle.activeUnitId !== unit.id) {
    return failure("not_active_unit", `${unit.name} is not the active unit`);
  }
  if (unit.defeated) return failure("attacker_defeated", `${unit.name} has been defeated`);
  if (hexEquals(unit.position, command.destination)) {
    return failure("same_position", "Unit is already on the destination tile");
  }
  if (!battle.tiles[hexKey(command.destination)]) {
    return failure("tile_not_found", "Destination is outside the battlefield");
  }

  const reachable = findReachableHexes(battle, unit.id);
  const route = reachable[hexKey(command.destination)];
  if (!route) return failure("destination_unreachable", "No legal route reaches that tile");

  return {
    ok: true,
    events: [{
      type: "battle.unit_moved",
      sequence: state.sequence + 1,
      battleId: battle.id,
      unitId: unit.id,
      from: unit.position,
      to: command.destination,
      path: route.path,
      movementSpent: route.cost,
    }],
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
  const declaredTarget = battle.units[command.targetId];
  if (!attacker) return failure("unit_not_found", `Attacker ${command.attackerId} does not exist`);
  if (!declaredTarget) return failure("target_not_found", `Target ${command.targetId} does not exist`);
  if (battle.activeUnitId !== attacker.id) {
    return failure("not_active_unit", `${attacker.name} is not the active unit`);
  }
  if (attacker.defeated) return failure("attacker_defeated", `${attacker.name} has been defeated`);
  if (declaredTarget.defeated) {
    return failure("target_defeated", `${declaredTarget.name} has already been defeated`);
  }
  if (attacker.factionId === declaredTarget.factionId) {
    return failure("friendly_target", "Friendly units cannot be attacked");
  }
  if (!attacker.mainActionAvailable) {
    return failure("main_action_unavailable", `${attacker.name} has spent the main action`);
  }
  if (!isAttackInRange(attacker, declaredTarget)) {
    return failure("attack_out_of_range", `${declaredTarget.name} is outside attack range`);
  }

  let sequence = state.sequence;
  const nextSequence = () => ++sequence;
  const events: DomainEvent[] = [];
  const guardian = findGuardingServant(battle, declaredTarget);
  const actualTarget = guardian ?? declaredTarget;

  events.push(
    {
      type: "battle.attack_started",
      sequence: nextSequence(),
      battleId: battle.id,
      attackerId: attacker.id,
      targetId: declaredTarget.id,
      kind: "normal",
    },
    {
      type: "battle.main_action_spent",
      sequence: nextSequence(),
      battleId: battle.id,
      unitId: attacker.id,
    },
  );

  if (guardian) {
    events.push(
      {
        type: "contract.master_guarded",
        sequence: nextSequence(),
        battleId: battle.id,
        masterId: declaredTarget.id,
        guardianId: guardian.id,
        attackerId: attacker.id,
      },
      {
        type: "battle.reaction_spent",
        sequence: nextSequence(),
        battleId: battle.id,
        unitId: guardian.id,
      },
    );
  }

  const damage = calculateDamage(attacker, actualTarget);
  events.push({
    type: "battle.damage_dealt",
    sequence: nextSequence(),
    battleId: battle.id,
    sourceId: attacker.id,
    targetId: actualTarget.id,
    amount: damage,
    kind: "normal",
  });

  const targetSurvives = appendLethalResolution(
    events,
    nextSequence,
    battle.id,
    actualTarget,
    attacker.id,
    damage,
  );

  if (!targetSurvives) return { ok: true, events };

  if (!guardian && canCounterattack(actualTarget, attacker)) {
    const counterDamage = calculateDamage(actualTarget, attacker);
    events.push(
      {
        type: "battle.attack_started",
        sequence: nextSequence(),
        battleId: battle.id,
        attackerId: actualTarget.id,
        targetId: attacker.id,
        kind: "counter",
      },
      {
        type: "battle.reaction_spent",
        sequence: nextSequence(),
        battleId: battle.id,
        unitId: actualTarget.id,
      },
      {
        type: "battle.damage_dealt",
        sequence: nextSequence(),
        battleId: battle.id,
        sourceId: actualTarget.id,
        targetId: attacker.id,
        amount: counterDamage,
        kind: "counter",
      },
    );
    appendLethalResolution(
      events,
      nextSequence,
      battle.id,
      attacker,
      actualTarget.id,
      counterDamage,
    );
  }

  return { ok: true, events };
}

function appendLethalResolution(
  events: DomainEvent[],
  nextSequence: () => number,
  battleId: BattleState["id"],
  target: BattleUnitState,
  sourceId: UnitId,
  damage: number,
): boolean {
  if (target.health > damage) return true;

  if (target.role === "servant" && target.deathWardActive) {
    events.push({
      type: "contract.death_rejected",
      sequence: nextSequence(),
      battleId,
      servantId: target.id,
      sourceId,
    });
    return true;
  }

  events.push({
    type: "battle.unit_defeated",
    sequence: nextSequence(),
    battleId,
    unitId: target.id,
    defeatedBy: sourceId,
  });
  return false;
}

function executeTransferMana(
  state: GameState,
  command: TransferManaCommand,
): CommandResult {
  const battle = state.battle;
  if (battle.id !== command.battleId) {
    return failure("battle_not_found", `Battle ${command.battleId} does not exist`);
  }

  const resolved = resolveContractMembers(battle, command.factionId);
  if (!resolved.ok) return resolved.result;
  const { contract, master, servant } = resolved;

  if (master.defeated) return failure("master_defeated", `${master.name} has been defeated`);
  if (servant.defeated) return failure("servant_defeated", `${servant.name} has been defeated`);
  if (battle.activeUnitId !== master.id) {
    return failure("master_not_active", `${master.name} must be the active unit to transfer mana`);
  }
  if (!master.mainActionAvailable) {
    return failure("main_action_unavailable", `${master.name} has spent the main action`);
  }
  if (hexDistance(master.position, servant.position) > contract.transferRange) {
    return failure("contract_out_of_range", `${servant.name} is outside the transfer range`);
  }
  if (master.mana <= 0) return failure("insufficient_mana", `${master.name} has no mana to transfer`);
  if (servant.mana >= servant.maxMana) {
    return failure("servant_mana_full", `${servant.name} already has full mana`);
  }

  const amount = Math.min(contract.transferAmount, master.mana, servant.maxMana - servant.mana);
  let sequence = state.sequence;
  const events: DomainEvent[] = [
    {
      type: "battle.main_action_spent",
      sequence: ++sequence,
      battleId: battle.id,
      unitId: master.id,
    },
    {
      type: "contract.mana_transferred",
      sequence: ++sequence,
      battleId: battle.id,
      factionId: contract.factionId,
      masterId: master.id,
      servantId: servant.id,
      amount,
    },
  ];

  const nextLowMana = isLowMana(servant, servant.mana + amount);
  if (nextLowMana !== servant.lowMana) {
    events.push({
      type: "contract.low_mana_changed",
      sequence: ++sequence,
      battleId: battle.id,
      servantId: servant.id,
      lowMana: nextLowMana,
    });
  }

  return { ok: true, events };
}

function executeUseCommandSeal(
  state: GameState,
  command: UseCommandSealCommand,
): CommandResult {
  const battle = state.battle;
  if (battle.id !== command.battleId) {
    return failure("battle_not_found", `Battle ${command.battleId} does not exist`);
  }

  const resolved = resolveContractMembers(battle, command.factionId);
  if (!resolved.ok) return resolved.result;
  const { contract, master, servant } = resolved;

  if (master.defeated) return failure("master_defeated", `${master.name} has been defeated`);
  if (servant.defeated) return failure("servant_defeated", `${servant.name} has been defeated`);
  if (contract.commandSeals <= 0) {
    return failure("command_seals_exhausted", `${master.name} has no command seals remaining`);
  }

  let sequence = state.sequence;
  const events: DomainEvent[] = [];
  const spendSeal = () => {
    events.push({
      type: "contract.command_seal_used",
      sequence: ++sequence,
      battleId: battle.id,
      factionId: contract.factionId,
      effect: command.effect,
    });
  };

  switch (command.effect) {
    case "recall": {
      if (hexDistance(master.position, servant.position) <= 1) {
        return failure("command_seal_no_effect", `${servant.name} is already beside ${master.name}`);
      }
      const destination = findRecallDestination(battle, contract);
      if (!destination) {
        return failure("recall_destination_unavailable", "No legal tile is available beside the Master");
      }
      spendSeal();
      events.push({
        type: "contract.servant_recalled",
        sequence: ++sequence,
        battleId: battle.id,
        servantId: servant.id,
        from: servant.position,
        to: destination,
      });
      break;
    }
    case "extra_turn": {
      if (
        battle.activeUnitId === servant.id &&
        servant.remainingMovement === servant.movement &&
        servant.mainActionAvailable &&
        servant.reactionAvailable
      ) {
        return failure("command_seal_no_effect", `${servant.name} already has a fresh turn`);
      }
      spendSeal();
      events.push({
        type: "contract.extra_turn_granted",
        sequence: ++sequence,
        battleId: battle.id,
        servantId: servant.id,
      });
      break;
    }
    case "mana_infusion": {
      if (servant.mana >= servant.maxMana) {
        return failure("command_seal_no_effect", `${servant.name} already has full mana`);
      }
      const amount = servant.maxMana - servant.mana;
      spendSeal();
      events.push({
        type: "contract.mana_restored",
        sequence: ++sequence,
        battleId: battle.id,
        servantId: servant.id,
        amount,
      });
      if (servant.lowMana) {
        events.push({
          type: "contract.low_mana_changed",
          sequence: ++sequence,
          battleId: battle.id,
          servantId: servant.id,
          lowMana: false,
        });
      }
      break;
    }
    case "reject_death": {
      if (servant.deathWardActive) {
        return failure("command_seal_no_effect", "Reject Death is already prepared");
      }
      spendSeal();
      events.push({
        type: "contract.death_ward_activated",
        sequence: ++sequence,
        battleId: battle.id,
        servantId: servant.id,
      });
      break;
    }
    default:
      return assertNever(command.effect);
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
  if (!unit) return failure("unit_not_found", `Unit ${command.unitId} does not exist`);
  if (battle.activeUnitId !== command.unitId) {
    return failure("not_active_unit", `${unit.name} is not the active unit`);
  }

  const next = findNextLivingUnit(battle, command.unitId);
  if (!next) return failure("initiative_invalid", "No living unit can take the next turn");

  let sequence = state.sequence;
  const events: DomainEvent[] = [];

  if (next.roundsAdvanced > 0) {
    for (const contract of Object.values(battle.contracts).sort((a, b) =>
      String(a.factionId).localeCompare(String(b.factionId)),
    )) {
      const servant = battle.units[contract.servantId];
      if (!servant || servant.defeated) continue;
      const paid = Math.min(servant.mana, contract.upkeep);
      const nextMana = servant.mana - paid;
      events.push({
        type: "contract.servant_upkeep_paid",
        sequence: ++sequence,
        battleId: battle.id,
        factionId: contract.factionId,
        servantId: servant.id,
        amount: paid,
        required: contract.upkeep,
      });

      const nextLowMana = isLowMana(servant, nextMana);
      if (nextLowMana !== servant.lowMana) {
        events.push({
          type: "contract.low_mana_changed",
          sequence: ++sequence,
          battleId: battle.id,
          servantId: servant.id,
          lowMana: nextLowMana,
        });
      }

      if (paid < contract.upkeep) {
        const unpaid = contract.upkeep - paid;
        events.push({
          type: "contract.stability_changed",
          sequence: ++sequence,
          battleId: battle.id,
          factionId: contract.factionId,
          stability: Math.max(0, contract.stability - unpaid * 2),
        });
      }
    }
  }

  events.push({
    type: "battle.turn_advanced",
    sequence: ++sequence,
    battleId: battle.id,
    previousUnitId: command.unitId,
    activeUnitId: next.unitId,
    round: battle.round + next.roundsAdvanced,
  });

  return { ok: true, events };
}

function resolveContractMembers(
  battle: BattleState,
  factionId: FactionId,
):
  | {
      readonly ok: true;
      readonly contract: ContractState;
      readonly master: BattleUnitState;
      readonly servant: BattleUnitState;
    }
  | { readonly ok: false; readonly result: CommandResult } {
  const contract = getContractByFaction(battle, factionId);
  if (!contract) {
    return { ok: false, result: failure("contract_not_found", `Faction ${factionId} has no contract`) };
  }
  const master = battle.units[contract.masterId];
  const servant = battle.units[contract.servantId];
  if (!master) {
    return { ok: false, result: failure("unit_not_found", `Master ${contract.masterId} does not exist`) };
  }
  if (!servant) {
    return { ok: false, result: failure("unit_not_found", `Servant ${contract.servantId} does not exist`) };
  }
  return { ok: true, contract, master, servant };
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
  throw new Error(`Unhandled value: ${JSON.stringify(value)}`);
}
