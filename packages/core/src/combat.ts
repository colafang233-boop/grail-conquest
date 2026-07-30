import { hexDistance } from "./hex";
import type { BattleState, BattleUnitState } from "./state";
import type { UnitId } from "./ids";

export function calculateDamage(attacker: BattleUnitState, target: BattleUnitState): number {
  const attackPower = attacker.lowMana && attacker.role === "servant"
    ? Math.max(1, Math.floor(attacker.attackPower * 0.75))
    : attacker.attackPower;
  return Math.max(1, attackPower - target.defense);
}

export function isAttackInRange(attacker: BattleUnitState, target: BattleUnitState): boolean {
  return attacker.deployed && target.deployed && hexDistance(attacker.position, target.position) <= attacker.attackRange;
}

export function canCounterattack(reactor: BattleUnitState, target: BattleUnitState): boolean {
  return reactor.deployed && target.deployed && !reactor.defeated && reactor.reactionAvailable &&
    hexDistance(reactor.position, target.position) <= reactor.counterRange;
}

export function findLegalAttackTargets(battle: BattleState, attackerId: UnitId): readonly BattleUnitState[] {
  const attacker = battle.units[attackerId];
  if (!attacker || !attacker.deployed || attacker.defeated || !attacker.mainActionAvailable) return [];
  return Object.values(battle.units).filter(target =>
    target.deployed && !target.defeated && target.factionId !== attacker.factionId && isAttackInRange(attacker, target),
  );
}
