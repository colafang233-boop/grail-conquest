import { createSchoolBattleState } from "./school-battle";
import {
  EMIYA_FACTION_ID,
  RYOUDOU_FACTION_ID,
  STRATEGY_FACTION_ID,
} from "./strategy";
import type { FactionId } from "./ids";
import type { StrategicOrderType } from "./state";

export interface BalanceSimulationOptions {
  readonly runs: number;
  readonly seed: number;
}

export interface FactionBalanceMetrics {
  readonly factionId: string;
  readonly games: number;
  readonly wins: number;
  readonly winRate: number;
  readonly encounterRate: number;
  readonly commandSealUsageRate: number;
  readonly averageRemainingHealth: number;
  readonly averageRemainingMana: number;
  readonly orderUsage: Readonly<Record<StrategicOrderType, number>>;
}

export interface BalanceReport {
  readonly schemaVersion: 1;
  readonly runsPerFaction: number;
  readonly seed: number;
  readonly generatedBy: "@grail/core/simulation";
  readonly factions: readonly FactionBalanceMetrics[];
  readonly warnings: readonly string[];
}

const SELECTABLE_FACTIONS: readonly FactionId[] = [
  STRATEGY_FACTION_ID,
  EMIYA_FACTION_ID,
  RYOUDOU_FACTION_ID,
];

const ORDER_TYPES: readonly StrategicOrderType[] = [
  "move",
  "investigate",
  "defend_leyline",
  "ambush",
  "rest",
  "prepare_workshop",
];

export function runBalanceTournament(options: BalanceSimulationOptions): BalanceReport {
  const runs = Math.max(1, Math.floor(options.runs));
  const state = createSchoolBattleState();
  const factions = SELECTABLE_FACTIONS.map(factionId => {
    let wins = 0;
    let encounters = 0;
    let sealUses = 0;
    let remainingHealth = 0;
    let remainingMana = 0;
    const orderUsage = createEmptyOrderUsage();
    const strategicFaction = state.strategy.factions[factionId];
    if (!strategicFaction) throw new Error(`Missing simulation faction ${factionId}`);
    const units = [strategicFaction.masterUnitId, ...strategicFaction.servantUnitIds]
      .map(unitId => state.battle.units[unitId])
      .filter((unit): unit is NonNullable<typeof unit> => Boolean(unit));
    const power = units.reduce(
      (sum, unit) => sum + unit.attackPower * 1.5 + unit.defense + unit.maxHealth * 0.12 + unit.maxMana * 0.06,
      0,
    );

    for (let run = 0; run < runs; run += 1) {
      const orderRoll = deterministicPercent(options.seed, `${factionId}:${run}:order`);
      const order = ORDER_TYPES[orderRoll % ORDER_TYPES.length] ?? "move";
      orderUsage[order] += 1;

      const encounterRoll = deterministicPercent(options.seed, `${factionId}:${run}:encounter`);
      const encounter = encounterRoll < 68 + (order === "ambush" ? 12 : order === "rest" ? -20 : 0);
      if (encounter) encounters += 1;

      const variance = deterministicPercent(options.seed, `${factionId}:${run}:battle`) - 50;
      const routeModifier = factionId === EMIYA_FACTION_ID ? 4 : factionId === RYOUDOU_FACTION_ID ? 2 : 3;
      const winScore = 50 + (power - 250) * 0.08 + variance * 0.72 + routeModifier;
      const won = !encounter || winScore >= 50;
      if (won) wins += 1;

      const sealUsed = encounter && deterministicPercent(options.seed, `${factionId}:${run}:seal`) < 42;
      if (sealUsed) sealUses += 1;
      const attrition = encounter ? 20 + deterministicPercent(options.seed, `${factionId}:${run}:attrition`) * 0.45 : 4;
      const totalHealth = units.reduce((sum, unit) => sum + unit.maxHealth, 0);
      const totalMana = units.reduce((sum, unit) => sum + unit.maxMana, 0);
      remainingHealth += Math.max(0, totalHealth - attrition);
      remainingMana += Math.max(0, totalMana - attrition * 0.8 - (sealUsed ? 0 : 8));
    }

    return {
      factionId: String(factionId),
      games: runs,
      wins,
      winRate: round4(wins / runs),
      encounterRate: round4(encounters / runs),
      commandSealUsageRate: round4(sealUses / runs),
      averageRemainingHealth: round2(remainingHealth / runs),
      averageRemainingMana: round2(remainingMana / runs),
      orderUsage,
    };
  });

  return {
    schemaVersion: 1,
    runsPerFaction: runs,
    seed: options.seed,
    generatedBy: "@grail/core/simulation",
    factions,
    warnings: validateBalanceThresholds(factions),
  };
}

export function validateBalanceThresholds(
  factions: readonly FactionBalanceMetrics[],
): readonly string[] {
  const warnings: string[] = [];
  for (const faction of factions) {
    if (faction.winRate < 0.2) warnings.push(`${faction.factionId} appears non-functional: winRate=${faction.winRate}`);
    if (faction.winRate > 0.8) warnings.push(`${faction.factionId} appears dominant: winRate=${faction.winRate}`);
    if (faction.encounterRate < 0.25) warnings.push(`${faction.factionId} rarely reaches encounters: encounterRate=${faction.encounterRate}`);
  }
  return warnings;
}

function createEmptyOrderUsage(): Record<StrategicOrderType, number> {
  return {
    move: 0,
    investigate: 0,
    defend_leyline: 0,
    ambush: 0,
    rest: 0,
    prepare_workshop: 0,
  };
}

function deterministicPercent(seed: number, key: string): number {
  let hash = (seed ^ 0x9e3779b9) >>> 0;
  for (const character of key) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % 100;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
