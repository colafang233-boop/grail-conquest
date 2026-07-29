import { describe, expect, it } from "vitest";
import {
  ARCHER_UNIT_ID,
  LANCER_UNIT_ID,
  RIN_UNIT_ID,
  SCHOOL_BATTLE_ID,
  createSchoolBattleState,
  processCommand,
} from "../src";

function createEncounterState() {
  const started = processCommand(createSchoolBattleState(), { type: "scenario.begin_encounter" });
  if (!started.ok) throw new Error(started.error.message);
  return started.state;
}

describe("battle attacks", () => {
  it("deals deterministic damage and spends the main action", () => {
    const initial = createEncounterState();
    const result = processCommand(initial, {
      type: "battle.attack_unit",
      battleId: SCHOOL_BATTLE_ID,
      attackerId: ARCHER_UNIT_ID,
      targetId: LANCER_UNIT_ID,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.battle.units[LANCER_UNIT_ID]?.health).toBe(122);
    expect(result.state.battle.units[ARCHER_UNIT_ID]?.mainActionAvailable).toBe(false);
    expect(result.events.map(event => event.type)).toEqual([
      "battle.attack_started",
      "battle.main_action_spent",
      "battle.damage_dealt",
    ]);
  });

  it("triggers one counterattack when the target is adjacent", () => {
    const initial = createEncounterState();
    const adjacent = {
      ...initial,
      battle: {
        ...initial.battle,
        units: {
          ...initial.battle.units,
          [ARCHER_UNIT_ID]: {
            ...initial.battle.units[ARCHER_UNIT_ID]!,
            position: { q: 5, r: 2 },
          },
        },
      },
    };

    const result = processCommand(adjacent, {
      type: "battle.attack_unit",
      battleId: SCHOOL_BATTLE_ID,
      attackerId: ARCHER_UNIT_ID,
      targetId: LANCER_UNIT_ID,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.battle.units[ARCHER_UNIT_ID]?.health).toBe(94);
    expect(result.state.battle.units[LANCER_UNIT_ID]?.reactionAvailable).toBe(false);
    expect(result.events.filter(event => event.type === "battle.attack_started")).toHaveLength(2);
  });

  it("rejects friendly fire", () => {
    const result = processCommand(createEncounterState(), {
      type: "battle.attack_unit",
      battleId: SCHOOL_BATTLE_ID,
      attackerId: ARCHER_UNIT_ID,
      targetId: RIN_UNIT_ID,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("friendly_target");
  });

  it("defeats a target and prevents its counterattack", () => {
    const initial = createEncounterState();
    const fragileTarget = {
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

    const result = processCommand(fragileTarget, {
      type: "battle.attack_unit",
      battleId: SCHOOL_BATTLE_ID,
      attackerId: ARCHER_UNIT_ID,
      targetId: LANCER_UNIT_ID,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.battle.units[LANCER_UNIT_ID]?.defeated).toBe(true);
    expect(result.events.some(event => event.type === "battle.unit_defeated")).toBe(true);
    expect(result.events.some(event => event.type === "battle.reaction_spent")).toBe(false);
    expect(result.state.scenario.outcome).toBe("enemy_defeated");
  });

  it("skips defeated units when advancing initiative", () => {
    const initial = createEncounterState();
    const defeatedLancer = {
      ...initial,
      battle: {
        ...initial.battle,
        units: {
          ...initial.battle.units,
          [LANCER_UNIT_ID]: {
            ...initial.battle.units[LANCER_UNIT_ID]!,
            defeated: true,
            health: 0,
          },
        },
      },
    };

    const result = processCommand(defeatedLancer, {
      type: "battle.end_turn",
      battleId: SCHOOL_BATTLE_ID,
      unitId: ARCHER_UNIT_ID,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.battle.activeUnitId).toBe(RIN_UNIT_ID);
  });
});
