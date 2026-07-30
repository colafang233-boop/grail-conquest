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
  | { readonly type: "sweep"; readonly power: number }
  | { readonly type: "mana_drain"; readonly amount: number; readonly power: number };

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
  archer_projected_shot: { id: "archer_projected_shot", name: "投影射击", description: "投影远程武装并射击目标。", manaCost: 12, range: 6, target: "enemy", effects: [{ type: "damage", power: 30 }] },
  archer_projected_shield: { id: "archer_projected_shield", name: "投影盾", description: "为己方单位施加一次性投影护盾。", manaCost: 18, range: 3, target: "ally", effects: [{ type: "barrier", amount: 36 }] },
  archer_guard_support: { id: "archer_guard_support", name: "护援展开", description: "恢复反应机会并扩大护卫范围。", manaCost: 10, range: 0, target: "self", effects: [{ type: "guard_support", guardBonus: 1 }] },
  lancer_high_speed_thrust: { id: "lancer_high_speed_thrust", name: "高速突刺", description: "高速贴近目标并发动强力突刺。", manaCost: 10, range: 2, target: "enemy", effects: [{ type: "dash_strike", power: 34 }] },
  lancer_battle_continuation: { id: "lancer_battle_continuation", name: "战斗续行", description: "下一次致命伤害将生命保留在1点。", manaCost: 16, range: 0, target: "self", effects: [{ type: "battle_continuation" }] },
  lancer_sweeping_strike: { id: "lancer_sweeping_strike", name: "长枪横扫", description: "同时攻击所有相邻敌方单位。", manaCost: 14, range: 1, target: "all_adjacent_enemies", effects: [{ type: "sweep", power: 24 }] },
  saber_invisible_air: { id: "saber_invisible_air", name: "风王结界", description: "隐藏剑身并形成风之防护。", manaCost: 14, range: 0, target: "self", effects: [{ type: "barrier", amount: 28 }] },
  saber_instinct: { id: "saber_instinct", name: "直感", description: "恢复反应能力并扩大保护范围。", manaCost: 10, range: 0, target: "self", effects: [{ type: "guard_support", guardBonus: 2 }] },
  saber_mana_burst: { id: "saber_mana_burst", name: "魔力放出", description: "以魔力强化突进和斩击。", manaCost: 18, range: 3, target: "enemy", effects: [{ type: "dash_strike", power: 42 }] },
  caster_dragon_tooth: { id: "caster_dragon_tooth", name: "龙牙兵阵列", description: "召唤龙牙兵形成临时防线。", manaCost: 16, range: 0, target: "self", effects: [{ type: "barrier", amount: 32 }] },
  caster_boundary_field: { id: "caster_boundary_field", name: "境界结界", description: "为己方单位施加高强度结界。", manaCost: 20, range: 4, target: "ally", effects: [{ type: "barrier", amount: 40 }] },
  caster_mana_drain: { id: "caster_mana_drain", name: "魔力吸取", description: "造成魔术伤害并夺取目标魔力。", manaCost: 12, range: 5, target: "enemy", effects: [{ type: "mana_drain", amount: 18, power: 22 }] },
  caster_workshop_reinforcement: { id: "caster_workshop_reinforcement", name: "工房强化", description: "强化防御结界并恢复反应能力。", manaCost: 14, range: 0, target: "self", effects: [{ type: "barrier", amount: 24 }, { type: "guard_support", guardBonus: 2 }] },
};

export function getAbilityDefinition(abilityId: AbilityId): AbilityDefinition {
  return ABILITY_DEFINITIONS[abilityId];
}

export function calculateAbilityDamage(actor: BattleUnitState, target: BattleUnitState, power: number): number {
  const manaPenalty = actor.lowMana ? 0.75 : 1;
  return Math.max(1, Math.floor((power + actor.attackPower * 0.35 - target.defense) * manaPenalty));
}

export function findLegalAbilityTargets(battle: BattleState, actorId: UnitId, abilityId: AbilityId): readonly BattleUnitState[] {
  const actor = battle.units[actorId];
  if (!actor || !actor.deployed || actor.defeated || !actor.mainActionAvailable || !actor.abilityIds.includes(abilityId)) return [];
  const definition = getAbilityDefinition(abilityId);
  switch (definition.target) {
    case "self": return [actor];
    case "ally": return Object.values(battle.units).filter(target => target.deployed && !target.defeated && target.factionId === actor.factionId && hexDistance(actor.position, target.position) <= definition.range);
    case "enemy": return Object.values(battle.units).filter(target => target.deployed && !target.defeated && target.factionId !== actor.factionId && hexDistance(actor.position, target.position) <= definition.range);
    case "all_adjacent_enemies": return Object.values(battle.units).filter(target => target.deployed && !target.defeated && target.factionId !== actor.factionId && hexDistance(actor.position, target.position) <= 1);
  }
}

export function findDashDestination(battle: BattleState, actor: BattleUnitState, target: BattleUnitState) {
  const occupied = new Set(Object.values(battle.units).filter(unit => unit.deployed && !unit.defeated && unit.id !== actor.id).map(unit => hexKey(unit.position)));
  return getHexNeighbors(target.position)
    .filter(coord => { const tile = battle.tiles[hexKey(coord)]; return Boolean(tile && !tile.blocked && !occupied.has(hexKey(coord))); })
    .sort((left, right) => { const distance = hexDistance(actor.position, left) - hexDistance(actor.position, right); return distance !== 0 ? distance : hexKey(left).localeCompare(hexKey(right)); })[0];
}
