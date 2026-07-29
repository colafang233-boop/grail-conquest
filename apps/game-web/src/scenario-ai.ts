import {
  ARCHER_UNIT_ID,
  LANCER_UNIT_ID,
  RIN_UNIT_ID,
  TOHSAKA_FACTION_ID,
  findLegalAttackTargets,
  findReachableHexes,
  hexDistance,
  hexKey,
} from "@grail/core";
import { gameEngine } from "./game-engine";

export function runSchoolNightEnemyTurn(): void {
  let snapshot = gameEngine.getSnapshot();
  let { state } = snapshot;
  if (
    state.scenario.phase === "investigation" ||
    state.scenario.phase === "completed" ||
    state.battle.activeUnitId !== LANCER_UNIT_ID
  ) return;

  const lancer = state.battle.units[LANCER_UNIT_ID];
  if (!lancer || lancer.defeated) return;

  const chooseAttackTarget = () => {
    const current = gameEngine.getSnapshot().state;
    const legal = findLegalAttackTargets(current.battle, LANCER_UNIT_ID);
    return legal.find(unit => unit.id === RIN_UNIT_ID)
      ?? legal.find(unit => unit.id === ARCHER_UNIT_ID)
      ?? legal[0];
  };

  let target = chooseAttackTarget();
  if (!target) {
    const rin = state.battle.units[RIN_UNIT_ID];
    const fallback = state.battle.units[ARCHER_UNIT_ID];
    const pursuitTarget = rin && !rin.defeated ? rin : fallback;
    if (pursuitTarget) {
      const routes = Object.values(findReachableHexes(state.battle, LANCER_UNIT_ID));
      const destination = routes.sort((left, right) => {
        const distanceDelta = hexDistance(left.coord, pursuitTarget.position)
          - hexDistance(right.coord, pursuitTarget.position);
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
    }
    target = chooseAttackTarget();
  }

  if (target) {
    snapshot = gameEngine.getSnapshot();
    gameEngine.dispatch({
      type: "battle.attack_unit",
      battleId: snapshot.state.battle.id,
      attackerId: LANCER_UNIT_ID,
      targetId: target.id,
    });
  }

  state = gameEngine.getSnapshot().state;
  if (
    state.scenario.phase !== "completed" &&
    state.battle.activeUnitId === LANCER_UNIT_ID &&
    state.battle.units[LANCER_UNIT_ID]?.factionId !== TOHSAKA_FACTION_ID
  ) {
    gameEngine.dispatch({
      type: "battle.end_turn",
      battleId: state.battle.id,
      unitId: LANCER_UNIT_ID,
    });
  }
}
