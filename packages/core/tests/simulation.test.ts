import { describe, expect, it } from "vitest";
import { runBalanceTournament, validateBalanceThresholds } from "../src";

const emptyUsage = {
  move: 0,
  investigate: 0,
  defend_leyline: 0,
  ambush: 0,
  rest: 0,
  prepare_workshop: 0,
} as const;

describe("balance simulation", () => {
  it("produces deterministic metrics", () => {
    const first = runBalanceTournament({ runs: 200, seed: 20260730 });
    const second = runBalanceTournament({ runs: 200, seed: 20260730 });
    expect(first).toEqual(second);
    expect(first.factions.map(item => item.factionId).sort()).toEqual(["emiya", "ryudou", "tohsaka"]);
    expect(first.factions.every(item => item.games === 200)).toBe(true);
  });

  it("reports values outside regression thresholds", () => {
    const warnings = validateBalanceThresholds([
      {
        factionId: "fixture-high",
        games: 10,
        wins: 10,
        winRate: 1,
        encounterRate: 0.9,
        commandSealUsageRate: 0.2,
        averageRemainingHealth: 100,
        averageRemainingMana: 100,
        orderUsage: { ...emptyUsage, move: 10 },
      },
      {
        factionId: "fixture-low",
        games: 10,
        wins: 0,
        winRate: 0,
        encounterRate: 0.1,
        commandSealUsageRate: 0,
        averageRemainingHealth: 0,
        averageRemainingMana: 0,
        orderUsage: { ...emptyUsage, rest: 10 },
      },
    ]);
    expect(warnings.length).toBeGreaterThanOrEqual(3);
    expect(warnings.join("\n")).toContain("fixture-high");
    expect(warnings.join("\n")).toContain("fixture-low");
  });
});
