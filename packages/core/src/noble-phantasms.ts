import { hexDistance } from "./hex";
import type { BattleState, BattleUnitState } from "./state";
import type { UnitId } from "./ids";

export interface NoblePhantasmDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly manaCost: number;
  readonly range: number;
  readonly power: number;
  readonly requiredCharge: number;
  readonly interruptThreshold: number;
  readonly cooldown: number;
}

export const NOBLE_PHANTASM_DEFINITIONS: Readonly<Record<string, NoblePhantasmDefinition>> = {
  archer_reality_marble: {
    id: "archer_reality_marble",
    name: "固有结界·未完成",
    description: "以大量魔力展开未完成的固有结界，对锁定目标发动武装齐射。",
    manaCost: 45,
    range: 6,
    power: 64,
    requiredCharge: 2,
    interruptThreshold: 18,
    cooldown: 3,
  },
  lancer_causality_spear: {
    id: "lancer_causality_spear",
    name: "因果逆转之枪",
    description: "锁定目标后收束魔力，在下一次行动时释放高威胁单体宝具。",
    manaCost: 38,
    range: 8,
    power: 82,
    requiredCharge: 1,
    interruptThreshold: 18,
    cooldown: 3,
  },
};

export function getNoblePhantasmDefinition(definitionId: string): NoblePhantasmDefinition | undefined {
  return NOBLE_PHANTASM_DEFINITIONS[definitionId];
}

export function findLegalNoblePhantasmTargets(
  battle: BattleState,
  servantId: UnitId,
): readonly BattleUnitState[] {
  const servant = battle.units[servantId];
  const state = servant?.noblePhantasm;
  if (!servant || servant.defeated || !state || state.phase !== "hidden") return [];
  const definition = getNoblePhantasmDefinition(state.definitionId);
  if (!definition) return [];

  return Object.values(battle.units).filter(target =>
    !target.defeated &&
    target.factionId !== servant.factionId &&
    hexDistance(servant.position, target.position) <= definition.range,
  );
}
