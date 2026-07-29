import { describe, expect, it } from "vitest";
import {
  ARCHER_UNIT_ID,
  LANCER_UNIT_ID,
  RIN_UNIT_ID,
  SCHOOL_BATTLE_ID,
  createSchoolBattleState,
  processCommand,
} from "../src";

function beginEncounter() {
  const started = processCommand(createSchoolBattleState(), { type: "scenario.begin_encounter" });
  if (!started.ok) throw new Error(started.error.message);
  return started.state;
}

describe("school-night scenario", () => {
  it("starts with investigation and rejects tactical orders", () => {
    const initial = createSchoolBattleState();
    expect(initial.scenario.phase).toBe("investigation");

    const move = processCommand(initial, {
      type: "battle.move_unit",
      battleId: SCHOOL_BATTLE_ID,
      unitId: ARCHER_UNIT_ID,
      destination: { q: 2, r: 2 },
    });

    expect(move.ok).toBe(false);
    if (move.ok) return;
    expect(move.error.code).toBe("scenario_not_active");
  });

  it("opens the encounter and records the enemy class", () => {
    const started = processCommand(createSchoolBattleState(), { type: "scenario.begin_encounter" });
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.state.scenario.phase).toBe("encounter");
    expect(started.state.scenario.clues.map(clue => clue.id)).toContain("lancer_class");
  });

  it("derives clues from observed Lancer movement and attacks", () => {
    const initial = beginEncounter();
    const lancerTurn = {
      ...initial,
      battle: { ...initial.battle, activeUnitId: LANCER_UNIT_ID },
    };

    const moved = processCommand(lancerTurn, {
      type: "battle.move_unit",
      battleId: SCHOOL_BATTLE_ID,
      unitId: LANCER_UNIT_ID,
      destination: { q: 5, r: 2 },
    });
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    expect(moved.state.scenario.clues.map(clue => clue.id)).toContain("high_speed");

    const inRange = {
      ...moved.state,
      battle: {
        ...moved.state.battle,
        units: {
          ...moved.state.battle.units,
          [RIN_UNIT_ID]: {
            ...moved.state.battle.units[RIN_UNIT_ID]!,
            position: { q: 4, r: 2 },
          },
        },
      },
    };
    const attacked = processCommand(inRange, {
      type: "battle.attack_unit",
      battleId: SCHOOL_BATTLE_ID,
      attackerId: LANCER_UNIT_ID,
      targetId: RIN_UNIT_ID,
    });
    expect(attacked.ok).toBe(true);
    if (!attacked.ok) return;
    expect(attacked.state.scenario.clues.map(clue => clue.id)).toContain("red_spear");
  });

  it("opens tactical retreat when Lancer really starts preparing a noble phantasm", () => {
    const initial = beginEncounter();
    const lancerTurn = {
      ...initial,
      battle: { ...initial.battle, round: 3, activeUnitId: LANCER_UNIT_ID },
    };

    const result = processCommand(lancerTurn, {
      type: "noble_phantasm.prepare",
      battleId: SCHOOL_BATTLE_ID,
      servantId: LANCER_UNIT_ID,
      targetId: RIN_UNIT_ID,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.scenario.phase).toBe("noble_phantasm_warning");
    expect(result.state.battle.units[LANCER_UNIT_ID]?.noblePhantasm?.phase).toBe("preparing");
    const clueIds = result.state.scenario.clues.map(clue => clue.id);
    expect(clueIds).toContain("causality_reversal");
    expect(clueIds).toContain("celtic_origin");
  });

  it("retreats with persistent identity candidates and unlocked tactics", () => {
    const initial = beginEncounter();
    const warning = {
      ...initial,
      scenario: {
        ...initial.scenario,
        phase: "noble_phantasm_warning" as const,
        clues: [
          ...initial.scenario.clues,
          {
            id: "red_spear",
            category: "weapon" as const,
            label: "红色长枪",
            confidence: 80,
            source: "test",
            discoveredAtSequence: initial.sequence + 1,
          },
          {
            id: "causality_reversal",
            category: "noble_phantasm" as const,
            label: "因果逆转",
            confidence: 90,
            source: "test",
            discoveredAtSequence: initial.sequence + 2,
          },
          {
            id: "celtic_origin",
            category: "origin" as const,
            label: "凯尔特",
            confidence: 70,
            source: "test",
            discoveredAtSequence: initial.sequence + 3,
          },
        ],
      },
    };

    const result = processCommand(warning, { type: "scenario.retreat" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.scenario.phase).toBe("completed");
    expect(result.state.scenario.outcome).toBe("retreated_with_intel");
    expect(result.state.scenario.report?.candidates[0]?.name).toBe("库·丘林");
    expect(result.state.scenario.report?.candidates[0]?.confidence).toBeGreaterThan(70);
    expect(result.state.scenario.report?.unlockedTactics.length).toBeGreaterThan(0);
  });

  it("completes immediately when Lancer is defeated", () => {
    const initial = beginEncounter();
    const fragile = {
      ...initial,
      battle: {
        ...initial.battle,
        units: {
          ...initial.battle.units,
          [LANCER_UNIT_ID]: {
            ...initial.battle.units[LANCER_UNIT_ID]!,
            health: 1,
          },
        },
      },
    };

    const result = processCommand(fragile, {
      type: "battle.attack_unit",
      battleId: SCHOOL_BATTLE_ID,
      attackerId: ARCHER_UNIT_ID,
      targetId: LANCER_UNIT_ID,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.scenario.phase).toBe("completed");
    expect(result.state.scenario.outcome).toBe("enemy_defeated");
  });
});
