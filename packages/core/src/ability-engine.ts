import {
  calculateAbilityDamage,
  findDashDestination,
  findLegalAbilityTargets,
  getAbilityDefinition,
} from "./abilities";
import type {
  PrepareNoblePhantasmCommand,
  ReleaseNoblePhantasmCommand,
  UseAbilityCommand,
} from "./commands";
import type { DomainError } from "./errors";
import type { DomainEvent } from "./events";
import { hexDistance } from "./hex";
import { findLegalNoblePhantasmTargets, getNoblePhantasmDefinition } from "./noble-phantasms";
import type { BattleUnitState, GameState } from "./state";

export type AbilityCommandResult =
  | { readonly ok: true; readonly events: readonly DomainEvent[] }
  | { readonly ok: false; readonly error: DomainError };

export function executeAbilityCommand(
  state: GameState,
  command: UseAbilityCommand | PrepareNoblePhantasmCommand | ReleaseNoblePhantasmCommand,
): AbilityCommandResult {
  if (state.scenario.phase === "investigation") return failure("scenario_not_active", "Complete the investigation before issuing battle orders");
  if (state.scenario.phase === "completed") return failure("scenario_completed", "The active encounter has already ended");
  switch (command.type) {
    case "ability.use": return executeUseAbility(state, command);
    case "noble_phantasm.prepare": return executePrepareNoblePhantasm(state, command);
    case "noble_phantasm.release": return executeReleaseNoblePhantasm(state, command);
  }
}

function executeUseAbility(state: GameState, command: UseAbilityCommand): AbilityCommandResult {
  const battle = state.battle;
  if (battle.id !== command.battleId) return failure("battle_not_found", `Battle ${command.battleId} does not exist`);
  const actor = battle.units[command.actorId];
  if (!actor) return failure("unit_not_found", `Actor ${command.actorId} does not exist`);
  if (!actor.deployed) return failure("unit_not_found", `${actor.name} is not deployed in this encounter`);
  if (battle.activeUnitId !== actor.id) return failure("not_active_unit", `${actor.name} is not the active unit`);
  if (actor.defeated) return failure("attacker_defeated", `${actor.name} has been defeated`);
  if (!actor.mainActionAvailable) return failure("main_action_unavailable", `${actor.name} has spent the main action`);
  if (!actor.abilityIds.includes(command.abilityId)) return failure("ability_not_known", `${actor.name} does not know ${command.abilityId}`);

  const definition = getAbilityDefinition(command.abilityId);
  if (actor.mana < definition.manaCost) return failure("insufficient_mana", `${actor.name} lacks mana for ${definition.name}`);
  const legalTargets = findLegalAbilityTargets(battle, actor.id, command.abilityId);
  let targets: readonly BattleUnitState[];
  if (definition.target === "self") {
    if (command.targetId && command.targetId !== actor.id) return failure("ability_target_invalid", `${definition.name} targets self`);
    targets = [actor];
  } else if (definition.target === "all_adjacent_enemies") {
    if (legalTargets.length === 0) return failure("ability_no_targets", `${definition.name} has no adjacent enemies`);
    targets = legalTargets;
  } else {
    if (!command.targetId) return failure("ability_target_required", `${definition.name} requires a target`);
    const target = battle.units[command.targetId];
    if (!target || !target.deployed) return failure("target_not_found", `Target ${command.targetId} is not deployed`);
    if (!legalTargets.some(candidate => candidate.id === target.id)) return failure("ability_out_of_range", `${target.name} is not a legal target for ${definition.name}`);
    targets = [target];
  }

  if (command.abilityId === "lancer_battle_continuation" && actor.battleContinuationActive) return failure("ability_no_effect", "Battle Continuation is already prepared");
  if ((command.abilityId === "archer_guard_support" || command.abilityId === "saber_instinct") && actor.reactionAvailable && actor.guardBonus >= 1) {
    return failure("ability_no_effect", "Guard support is already active");
  }

  let sequence = state.sequence;
  const nextSequence = () => ++sequence;
  const events: DomainEvent[] = [
    { type: "ability.used", sequence: nextSequence(), battleId: battle.id, actorId: actor.id, abilityId: command.abilityId, targetIds: targets.map(target => target.id) },
    { type: "battle.main_action_spent", sequence: nextSequence(), battleId: battle.id, unitId: actor.id },
    { type: "battle.mana_spent", sequence: nextSequence(), battleId: battle.id, unitId: actor.id, amount: definition.manaCost, reason: "ability" },
  ];

  for (const effect of definition.effects) {
    switch (effect.type) {
      case "damage": {
        const target = targets[0];
        if (!target) return failure("ability_target_required", `${definition.name} requires a target`);
        appendDamage(events, nextSequence, battle.id, actor, target, effect.power);
        break;
      }
      case "barrier": {
        const target = targets[0];
        if (!target) return failure("ability_target_required", `${definition.name} requires a target`);
        events.push({ type: "ability.barrier_applied", sequence: nextSequence(), battleId: battle.id, sourceId: actor.id, targetId: target.id, amount: effect.amount });
        break;
      }
      case "guard_support":
        events.push({ type: "ability.guard_support_activated", sequence: nextSequence(), battleId: battle.id, servantId: actor.id, guardBonus: effect.guardBonus });
        break;
      case "dash_strike": {
        const target = targets[0];
        if (!target) return failure("ability_target_required", `${definition.name} requires a target`);
        if (hexDistance(actor.position, target.position) > 1) {
          const destination = findDashDestination(battle, actor, target);
          if (!destination) return failure("destination_unreachable", "No legal dash destination exists");
          events.push({ type: "battle.unit_displaced", sequence: nextSequence(), battleId: battle.id, unitId: actor.id, from: actor.position, to: destination, sourceId: actor.id });
        }
        appendDamage(events, nextSequence, battle.id, actor, target, effect.power);
        break;
      }
      case "battle_continuation":
        events.push({ type: "ability.battle_continuation_activated", sequence: nextSequence(), battleId: battle.id, servantId: actor.id });
        break;
      case "sweep":
        for (const target of targets.slice().sort((left, right) => String(left.id).localeCompare(String(right.id)))) {
          appendDamage(events, nextSequence, battle.id, actor, target, effect.power);
        }
        break;
      case "mana_drain": {
        const target = targets[0];
        if (!target) return failure("ability_target_required", `${definition.name} requires a target`);
        appendDamage(events, nextSequence, battle.id, actor, target, effect.power);
        const drained = Math.min(effect.amount, target.mana);
        if (drained > 0) {
          events.push(
            { type: "battle.mana_spent", sequence: nextSequence(), battleId: battle.id, unitId: target.id, amount: drained, reason: "ability" },
            { type: "contract.mana_restored", sequence: nextSequence(), battleId: battle.id, servantId: actor.id, amount: drained },
          );
        }
        break;
      }
    }
  }
  return { ok: true, events };
}

function appendDamage(
  events: DomainEvent[],
  nextSequence: () => number,
  battleId: GameState["battle"]["id"],
  actor: BattleUnitState,
  target: BattleUnitState,
  power: number,
): void {
  events.push(
    { type: "battle.attack_started", sequence: nextSequence(), battleId, attackerId: actor.id, targetId: target.id, kind: "ability" },
    { type: "battle.damage_dealt", sequence: nextSequence(), battleId, sourceId: actor.id, targetId: target.id, amount: calculateAbilityDamage(actor, target, power), kind: "ability" },
  );
}

function executePrepareNoblePhantasm(state: GameState, command: PrepareNoblePhantasmCommand): AbilityCommandResult {
  const battle = state.battle;
  if (battle.id !== command.battleId) return failure("battle_not_found", `Battle ${command.battleId} does not exist`);
  const servant = battle.units[command.servantId];
  const target = battle.units[command.targetId];
  if (!servant || !servant.deployed) return failure("unit_not_found", `Servant ${command.servantId} is not deployed`);
  if (!target || !target.deployed) return failure("target_not_found", `Target ${command.targetId} is not deployed`);
  if (battle.activeUnitId !== servant.id) return failure("not_active_unit", `${servant.name} is not the active unit`);
  if (servant.defeated) return failure("servant_defeated", `${servant.name} has been defeated`);
  if (!servant.mainActionAvailable) return failure("main_action_unavailable", `${servant.name} has spent the main action`);
  const nobleState = servant.noblePhantasm;
  if (!nobleState || nobleState.phase !== "hidden") return failure("noble_phantasm_unavailable", `${servant.name} cannot prepare a noble phantasm now`);
  const definition = getNoblePhantasmDefinition(nobleState.definitionId);
  if (!definition) return failure("noble_phantasm_unavailable", `Unknown noble phantasm ${nobleState.definitionId}`);
  if (servant.mana < definition.manaCost) return failure("insufficient_mana", `${servant.name} lacks mana for ${definition.name}`);
  if (!findLegalNoblePhantasmTargets(battle, servant.id).some(candidate => candidate.id === target.id)) return failure("noble_phantasm_target_invalid", `${target.name} cannot be locked by ${definition.name}`);
  return {
    ok: true,
    events: [
      { type: "battle.main_action_spent", sequence: state.sequence + 1, battleId: battle.id, unitId: servant.id },
      { type: "battle.mana_spent", sequence: state.sequence + 2, battleId: battle.id, unitId: servant.id, amount: definition.manaCost, reason: "noble_phantasm" },
      { type: "noble_phantasm.preparation_started", sequence: state.sequence + 3, battleId: battle.id, servantId: servant.id, definitionId: definition.id, targetId: target.id, requiredCharge: definition.requiredCharge, interruptThreshold: definition.interruptThreshold },
    ],
  };
}

function executeReleaseNoblePhantasm(state: GameState, command: ReleaseNoblePhantasmCommand): AbilityCommandResult {
  const battle = state.battle;
  if (battle.id !== command.battleId) return failure("battle_not_found", `Battle ${command.battleId} does not exist`);
  const servant = battle.units[command.servantId];
  if (!servant || !servant.deployed) return failure("unit_not_found", `Servant ${command.servantId} is not deployed`);
  if (battle.activeUnitId !== servant.id) return failure("not_active_unit", `${servant.name} is not the active unit`);
  if (!servant.mainActionAvailable) return failure("main_action_unavailable", `${servant.name} has spent the main action`);
  const nobleState = servant.noblePhantasm;
  if (!nobleState || nobleState.phase !== "ready" || !nobleState.targetId) return failure("noble_phantasm_not_ready", `${servant.name}'s noble phantasm is not ready`);
  const target = battle.units[nobleState.targetId];
  if (!target || !target.deployed || target.defeated || target.factionId === servant.factionId) return failure("noble_phantasm_target_invalid", "The locked noble-phantasm target is no longer valid");
  const definition = getNoblePhantasmDefinition(nobleState.definitionId);
  if (!definition) return failure("noble_phantasm_unavailable", `Unknown noble phantasm ${nobleState.definitionId}`);
  if (hexDistance(servant.position, target.position) > definition.range) return failure("noble_phantasm_out_of_range", `${target.name} escaped the noble-phantasm range`);
  const damage = Math.max(1, definition.power + Math.floor(servant.attackPower * 0.5) - target.defense);
  let sequence = state.sequence;
  return {
    ok: true,
    events: [
      { type: "battle.main_action_spent", sequence: ++sequence, battleId: battle.id, unitId: servant.id },
      { type: "noble_phantasm.released", sequence: ++sequence, battleId: battle.id, servantId: servant.id, definitionId: definition.id, targetId: target.id },
      { type: "battle.attack_started", sequence: ++sequence, battleId: battle.id, attackerId: servant.id, targetId: target.id, kind: "noble_phantasm" },
      { type: "battle.damage_dealt", sequence: ++sequence, battleId: battle.id, sourceId: servant.id, targetId: target.id, amount: damage, kind: "noble_phantasm" },
      { type: "noble_phantasm.cooldown_changed", sequence: ++sequence, battleId: battle.id, servantId: servant.id, remaining: definition.cooldown },
    ],
  };
}

function failure(code: DomainError["code"], message: string): AbilityCommandResult {
  return { ok: false, error: { code, message } };
}
