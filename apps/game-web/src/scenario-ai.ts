import {
  ARCHER_UNIT_ID,
  LANCER_UNIT_ID,
  RIN_UNIT_ID,
  TOHSAKA_FACTION_ID,
  findLegalAbilityTargets,
  findLegalAttackTargets,
  findReachableHexes,
  hexDistance,
  hexKey,
} from "@grail/core";
import { gameEngine } from "./game-engine";

export function runSchoolNightEnemyTurn(): void {
  let state = gameEngine.getSnapshot().state;
  if (
    state.scenario.phase === "investigation" ||
    state.scenario.phase === "completed" ||
    state.battle.activeUnitId !== LANCER_UNIT_ID
  ) return;

  let lancer = state.battle.units[LANCER_UNIT_ID];
  if (!lancer || lancer.defeated) return;

  const finishTurn = () => {
    const current = gameEngine.getSnapshot().state;
    if (
      current.scenario.phase !== "completed" &&
      current.battle.activeUnitId === LANCER_UNIT_ID &&
      current.battle.units[LANCER_UNIT_ID]?.factionId !== TOHSAKA_FACTION_ID
    ) {
      gameEngine.dispatch({
        type: "battle.end_turn",
        battleId: current.battle.id,
        unitId: LANCER_UNIT_ID,
      });
    }
  };

  if (lancer.noblePhantasm?.phase === "ready") {
    gameEngine.dispatch({
      type: "noble_phantasm.release",
      battleId: state.battle.id,
      servantId: LANCER_UNIT_ID,
    });
    finishTurn();
    return;
  }

  if (lancer.noblePhantasm?.phase === "preparing") {
    finishTurn();
    return;
  }

  const rin = state.battle.units[RIN_UNIT_ID];
  const archer = state.battle.units[ARCHER_UNIT_ID];
  const preferredTarget = rin && !rin.defeated ? rin : archer;

  if (
    preferredTarget &&
    state.battle.round >= state.scenario.warningRound &&
    lancer.noblePhantasm?.phase === "hidden" &&
    lancer.mainActionAvailable
  ) {
    gameEngine.dispatch({
      type: "noble_phantasm.prepare",
      battleId: state.battle.id,
      servantId: LANCER_UNIT_ID,
      targetId: preferredTarget.id,
    });
    finishTurn();
    return;
  }

  if (
    lancer.health <= 70 &&
    !lancer.battleContinuationActive &&
    lancer.mainActionAvailable &&
    lancer.mana >= 16
  ) {
    gameEngine.dispatch({
      type: "ability.use",
      battleId: state.battle.id,
      actorId: LANCER_UNIT_ID,
      abilityId: "lancer_battle_continuation",
    });
    finishTurn();
    return;
  }

  const adjacent = findLegalAbilityTargets(state.battle, LANCER_UNIT_ID, "lancer_sweeping_strike");
  if (adjacent.length >= 2) {
    gameEngine.dispatch({
      type: "ability.use",
      battleId: state.battle.id,
      actorId: LANCER_UNIT_ID,
      abilityId: "lancer_sweeping_strike",
    });
    finishTurn();
    return;
  }

  const thrustTargets = findLegalAbilityTargets(state.battle, LANCER_UNIT_ID, "lancer_high_speed_thrust");
  const thrustTarget = thrustTargets.find(unit => unit.id === RIN_UNIT_ID)
    ?? thrustTargets.find(unit => unit.id === ARCHER_UNIT_ID)
    ?? thrustTargets[0];
  if (thrustTarget) {
    gameEngine.dispatch({
      type: "ability.use",
      battleId: state.battle.id,
      actorId: LANCER_UNIT_ID,
      abilityId: "lancer_high_speed_thrust",
      targetId: thrustTarget.id,
    });
    finishTurn();
    return;
  }

  const chooseAttackTarget = () => {
    const current = gameEngine.getSnapshot().state;
    const legal = findLegalAttackTargets(current.battle, LANCER_UNIT_ID);
    return legal.find(unit => unit.id === RIN_UNIT_ID)
      ?? legal.find(unit => unit.id === ARCHER_UNIT_ID)
      ?? legal[0];
  };

  let target = chooseAttackTarget();
  if (!target && preferredTarget) {
    const routes = Object.values(findReachableHexes(state.battle, LANCER_UNIT_ID));
    const destination = routes.sort((left, right) => {
      const distanceDelta = hexDistance(left.coord, preferredTarget.position)
        - hexDistance(right.coord, preferredTarget.position);
      if (distanceDelta !== 0) return distanceDelta;
      if (left.cost !== right.cost) return left.cost - right.cost;
      return hexKey(left.coord).localeCompare(hexKey(right.coord));
    })[0];

    if (destination) {
      gameEngine.dispatch({
        type: "battle.move_unit",
        battleId: state.battle.id,
        unitId: LANCER_UNIT_ID,
        destination: destination.coord,
      });
    }
    target = chooseAttackTarget();
  }

  if (target) {
    state = gameEngine.getSnapshot().state;
    lancer = state.battle.units[LANCER_UNIT_ID];
    if (lancer?.mainActionAvailable) {
      gameEngine.dispatch({
        type: "battle.attack_unit",
        battleId: state.battle.id,
        attackerId: LANCER_UNIT_ID,
        targetId: target.id,
      });
    }
  }

  finishTurn();
}
