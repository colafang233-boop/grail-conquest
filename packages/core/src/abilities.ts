import { getHexNeighbors, hexDistance, hexKey } from "./hex";
import type { BattleState, BattleUnitState, AbilityId } from "./state";
import type { UnitId } from "./ids";

export type AbilityTarget = "self" | "ally" | "enemy" | "all_adjacent_enemies";

export type AbilityEffect =
  | { readonly type: "damage"; readonly power: number }
  | { readonly type: "barrier"; readonly amount: number }
  | { readonly type: "guard_support"; readonly guardBonus: number }
  | { readonly type: "dash_strike"; readonly power: number }
  | { readonly type: "battle_continuation" }
  | { readonly type: "sweep"; readonly power: number };

export interface AbilityDefinition {
  readonly id: AbilityId;
  readonly name: string;
  readonly description: string;
  readonly manaCost: number;
  readonly range: number;
  readonly target: AbilityTarget;
  readonly effects: readonly AbilityEffect[];
}

export const ABILITY_DEFINITIONS: Readonly<Record<AbilityId, AbilityDefinition>> = {
  archer_projected_shot: {
    id: "archer_projected_shot",
    name: "投影射击",
    description: "投影远程武装并射击目标。造成足够伤害时可打断宝具准备。",
    manaCost: 12,
    range: 6,
    target: "enemy",
    effects: [{ type: "damage", power: 30 }],
  },
  archer_projected_shield: {
    id: "archer_projected_shield",
    name: "投影盾",
    description: "为己方单位施加一次性投影护盾，优先吸收后续伤害。",
    manaCost: 18,
    range: 3,
    target: "ally",
    effects: [{ type: "barrier", amount: 36 }],
  },
  archer_guard_support: {
    id: "archer_guard_support",
    name: "护援展开",
    description: "重新获得反应机会，并扩大本轮对 Master 的护卫范围。",
    manaCost: 10,
    range: 0,
    target: "self",
    effects: [{ type: "guard_support", guardBonus: 1 }],
  },
  lancer_high_speed_thrust: {
    id: "lancer_high_speed_thrust",
    name: "高速突刺",
    description: "高速贴近目标并发动强力突刺。",
    manaCost: 10,
    range: 2,
    target: "enemy",
    effects: [{ type: "dash_strike", power: 34 }],
  },
  lancer_battle_continuation: {
    id: "lancer_battle_continuation",
    name: "战斗续行",
    description: "准备一次濒死续战，下一次致命伤害将把生命保留在 1 点。",
    manaCost: 16,
    range: 0,
    target: "self",
    effects: [{ type: "battle_continuation" }],
  },
  lancer_sweeping_strike: {
    id: "lancer_sweeping_strike",
    name: "长枪横扫",
    description: "同时攻击所有相邻敌方单位。",
    manaCost: 14,
    range: 1,
    target: "all_adjacent_enemies",
    effects: [{ type: "sweep", power: 24 }],
  },
};

export function getAbilityDefinition(abilityId: AbilityId): AbilityDefinition {
  return ABILITY_DEFINITIONS[abilityId];
}

export function calculateAbilityDamage(
  actor: BattleUnitState,
  target: BattleUnitState,
  power: number,
): number {
  const manaPenalty = actor.lowMana ? 0.75 : 1;
  return Math.max(1, Math.floor((power + actor.attackPower * 0.35 - target.defense) * manaPenalty));
}

export function findLegalAbilityTargets(
  battle: BattleState,
  actorId: UnitId,
  abilityId: AbilityId,
): readonly BattleUnitState[] {
  const actor = battle.units[actorId];
  if (!actor || actor.defeated || !actor.mainActionAvailable || !actor.abilityIds.includes(abilityId)) return [];
  const definition = getAbilityDefinition(abilityId);

  switch (definition.target) {
    case "self":
      return [actor];
    case "ally":
      return Object.values(battle.units).filter(target =>
        !target.defeated &&
        target.factionId === actor.factionId &&
        hexDistance(actor.position, target.position) <= definition.range,
      );
    case "enemy":
      return Object.values(battle.units).filter(target =>
        !target.defeated &&
        target.factionId !== actor.factionId &&
        hexDistance(actor.position, target.position) <= definition.range,
      );
    case "all_adjacent_enemies":
      return Object.values(battle.units).filter(target =>
        !target.defeated &&
        target.factionId !== actor.factionId &&
        hexDistance(actor.position, target.position) <= 1,
      );
  }
}

export function findDashDestination(
  battle: BattleState,
  actor: BattleUnitState,
  target: BattleUnitState,
) {
  const occupied = new Set(
    Object.values(battle.units)
      .filter(unit => !unit.defeated && unit.id !== actor.id)
      .map(unit => hexKey(unit.position)),
  );

  return getHexNeighbors(target.position)
    .filter(coord => {
      const tile = battle.tiles[hexKey(coord)];
      return Boolean(tile && !tile.blocked && !occupied.has(hexKey(coord)));
    })
    .sort((left, right) => {
      const distance = hexDistance(actor.position, left) - hexDistance(actor.position, right);
      return distance !== 0 ? distance : hexKey(left).localeCompare(hexKey(right));
    })[0];
}
