import {
  ARCHER_UNIT_ID,
  ASSASSIN_UNIT_ID,
  CASTER_UNIT_ID,
  LANCER_UNIT_ID,
  RIN_UNIT_ID,
  SABER_UNIT_ID,
  TOHSAKA_FACTION_ID,
  areFactionsHostile,
  findLegalAbilityTargets,
  findLegalAttackTargets,
  findLegalNoblePhantasmTargets,
  findReachableHexes,
  hexDistance,
  hexKey,
  type AbilityId,
  type BattleUnitState,
} from "@grail/core";
import { gameEngine } from "./game-engine";

export function runEncounterAiTurn(): void {
  let state = gameEngine.getSnapshot().state;
  if (state.mode !== "battle" || state.scenario.phase === "investigation" || state.scenario.phase === "completed") return;
  const activeId = state.battle.activeUnitId;
  let active = state.battle.units[activeId];
  if (!active?.deployed || active.defeated || active.factionId === TOHSAKA_FACTION_ID) return;

  const finishTurn = () => {
    const current = gameEngine.getSnapshot().state;
    const currentUnit = current.battle.units[current.battle.activeUnitId];
    if (current.mode === "battle" && current.scenario.phase !== "completed" && currentUnit?.deployed && currentUnit.factionId !== TOHSAKA_FACTION_ID) {
      gameEngine.dispatch({ type: "battle.end_turn", battleId: current.battle.id, unitId: currentUnit.id });
    }
  };

  const hostileTargets = () => {
    const current = gameEngine.getSnapshot().state;
    const actor = current.battle.units[activeId];
    if (!actor) return [];
    return Object.values(current.battle.units)
      .filter(unit => unit.deployed && !unit.defeated && unit.id !== actor.id)
      .filter(unit => areFactionsHostile(current, actor.factionId, unit.factionId))
      .sort(targetPriority);
  };

  let targets = hostileTargets();
  if (targets.length === 0) {
    finishTurn();
    return;
  }

  if (active.noblePhantasm?.phase === "ready") {
    const legal = findLegalNoblePhantasmTargets(state.battle, active.id).filter(target => areFactionsHostile(state, active!.factionId, target.factionId));
    if (legal.some(target => target.id === active?.noblePhantasm?.targetId)) {
      gameEngine.dispatch({ type: "noble_phantasm.release", battleId: state.battle.id, servantId: active.id });
      finishTurn();
      return;
    }
  }
  if (active.noblePhantasm?.phase === "preparing") {
    finishTurn();
    return;
  }

  if (tryAuthoredAbility(state, active, targets)) {
    finishTurn();
    return;
  }

  state = gameEngine.getSnapshot().state;
  active = state.battle.units[activeId];
  targets = hostileTargets();
  if (!active || targets.length === 0) {
    finishTurn();
    return;
  }

  if (state.battle.round >= state.scenario.warningRound && active.noblePhantasm?.phase === "hidden" && active.mainActionAvailable) {
    const nobleTargets = findLegalNoblePhantasmTargets(state.battle, active.id)
      .filter(target => areFactionsHostile(state, active!.factionId, target.factionId))
      .sort(targetPriority);
    const nobleTarget = nobleTargets[0];
    if (nobleTarget) {
      gameEngine.dispatch({ type: "noble_phantasm.prepare", battleId: state.battle.id, servantId: active.id, targetId: nobleTarget.id });
      finishTurn();
      return;
    }
  }

  const chooseAttackTarget = () => {
    const current = gameEngine.getSnapshot().state;
    const actor = current.battle.units[activeId];
    if (!actor) return undefined;
    return findLegalAttackTargets(current.battle, activeId)
      .filter(target => areFactionsHostile(current, actor.factionId, target.factionId))
      .sort(targetPriority)[0];
  };

  let target = chooseAttackTarget();
  const preferred = targets[0];
  if (!target && preferred) {
    const routes = Object.values(findReachableHexes(state.battle, activeId));
    const destination = routes.sort((left, right) => {
      const distanceDelta = hexDistance(left.coord, preferred.position) - hexDistance(right.coord, preferred.position);
      if (distanceDelta !== 0) return distanceDelta;
      if (left.cost !== right.cost) return left.cost - right.cost;
      return hexKey(left.coord).localeCompare(hexKey(right.coord));
    })[0];
    if (destination) gameEngine.dispatch({ type: "battle.move_unit", battleId: state.battle.id, unitId: activeId, destination: destination.coord });
    target = chooseAttackTarget();
  }

  if (target) {
    const current = gameEngine.getSnapshot().state;
    const actor = current.battle.units[activeId];
    if (actor?.mainActionAvailable) gameEngine.dispatch({ type: "battle.attack_unit", battleId: current.battle.id, attackerId: activeId, targetId: target.id });
  }
  finishTurn();
}

export const runSchoolNightEnemyTurn = runEncounterAiTurn;

function tryAuthoredAbility(
  state: ReturnType<typeof gameEngine.getSnapshot>["state"],
  actor: BattleUnitState,
  targets: readonly BattleUnitState[],
): boolean {
  if (!actor.mainActionAvailable) return false;

  if (actor.id === LANCER_UNIT_ID) {
    if (actor.health <= 70 && !actor.battleContinuationActive && actor.mana >= 16) return useSelf("lancer_battle_continuation", actor);
    const sweep = hostileAbilityTargets(state, actor, "lancer_sweeping_strike");
    if (sweep.length >= 2) return useSelf("lancer_sweeping_strike", actor);
    return useTargetedIfAvailable(state, actor, "lancer_high_speed_thrust", targets);
  }

  if (actor.id === SABER_UNIT_ID) {
    if (actor.barrier <= 0 && actor.mana >= 14) return useSelf("saber_invisible_air", actor);
    if (!actor.reactionAvailable && actor.mana >= 10) return useSelf("saber_instinct", actor);
    return useTargetedIfAvailable(state, actor, "saber_mana_burst", targets);
  }

  if (actor.id === CASTER_UNIT_ID) {
    if (actor.barrier <= 10 && actor.mana >= 14) return useSelf("caster_workshop_reinforcement", actor);
    const ally = findLegalAbilityTargets(state.battle, actor.id, "caster_boundary_field")
      .filter(unit => unit.factionId === actor.factionId && unit.barrier < 20)
      .sort((left, right) => left.health - right.health)[0];
    if (ally && actor.mana >= 20) {
      gameEngine.dispatch({ type: "ability.use", battleId: state.battle.id, actorId: actor.id, abilityId: "caster_boundary_field", targetId: ally.id });
      return true;
    }
    return useTargetedIfAvailable(state, actor, "caster_mana_drain", targets);
  }

  if (actor.id === ASSASSIN_UNIT_ID && !actor.reactionAvailable && actor.mana >= 10) {
    return useSelf("saber_instinct", actor);
  }
  return false;
}

function hostileAbilityTargets(
  state: ReturnType<typeof gameEngine.getSnapshot>["state"],
  actor: BattleUnitState,
  abilityId: AbilityId,
): readonly BattleUnitState[] {
  return findLegalAbilityTargets(state.battle, actor.id, abilityId)
    .filter(target => target.factionId === actor.factionId || areFactionsHostile(state, actor.factionId, target.factionId))
    .sort(targetPriority);
}

function useTargetedIfAvailable(
  state: ReturnType<typeof gameEngine.getSnapshot>["state"],
  actor: BattleUnitState,
  abilityId: AbilityId,
  preferredTargets: readonly BattleUnitState[],
): boolean {
  const legal = hostileAbilityTargets(state, actor, abilityId);
  const target = preferredTargets.find(preferred => legal.some(candidate => candidate.id === preferred.id)) ?? legal[0];
  if (!target) return false;
  const result = gameEngine.dispatch({ type: "ability.use", battleId: state.battle.id, actorId: actor.id, abilityId, targetId: target.id });
  return result.ok;
}

function useSelf(abilityId: AbilityId, actor: BattleUnitState): boolean {
  const state = gameEngine.getSnapshot().state;
  const result = gameEngine.dispatch({ type: "ability.use", battleId: state.battle.id, actorId: actor.id, abilityId });
  return result.ok;
}

function targetPriority(left: BattleUnitState, right: BattleUnitState): number {
  const roleDelta = (left.role === "master" ? 0 : left.role === "servant" ? 1 : 2) -
    (right.role === "master" ? 0 : right.role === "servant" ? 1 : 2);
  if (roleDelta !== 0) return roleDelta;
  if (left.health !== right.health) return left.health - right.health;
  if (left.id === RIN_UNIT_ID || left.id === ARCHER_UNIT_ID) return -1;
  if (right.id === RIN_UNIT_ID || right.id === ARCHER_UNIT_ID) return 1;
  return String(left.id).localeCompare(String(right.id));
}
