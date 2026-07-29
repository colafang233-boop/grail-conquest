import { describe, expect, it } from "vitest";
import {
  ARCHER_UNIT_ID,
  LANCER_UNIT_ID,
  SCHOOL_BATTLE_ID,
  createSchoolBattleState,
  findReachableHexes,
  hexKey,
  processCommand,
} from "../src";

function createEncounterState() {
  const started = processCommand(createSchoolBattleState(), { type: "scenario.begin_encounter" });
  if (!started.ok) throw new Error(started.error.message);
  return started.state;
}

describe("battle movement", () => {
  it("moves the active unit along a legal path", () => {
    const initial = createEncounterState();
    const result = processCommand(initial, {
      type: "battle.move_unit",
      battleId: SCHOOL_BATTLE_ID,
      unitId: ARCHER_UNIT_ID,
      destination: { q: 2, r: 2 },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.battle.units[ARCHER_UNIT_ID]?.position).toEqual({ q: 2, r: 2 });
    expect(result.state.battle.units[ARCHER_UNIT_ID]?.remainingMovement).toBe(3);
    expect(result.events[0]).toMatchObject({
      type: "battle.unit_moved",
      movementSpent: 1,
    });
  });

  it("routes around walls instead of using straight-line distance", () => {
    const state = createSchoolBattleState();
    const reachable = findReachableHexes(state.battle, ARCHER_UNIT_ID);
    const route = reachable[hexKey({ q: 4, r: 1 })];

    expect(route).toBeDefined();
    expect(route?.path.every(coord => state.battle.tiles[hexKey(coord)]?.blocked !== true)).toBe(true);
  });

  it("rejects occupied destinations", () => {
    const initial = createEncounterState();
    const result = processCommand(initial, {
      type: "battle.move_unit",
      battleId: SCHOOL_BATTLE_ID,
      unitId: ARCHER_UNIT_ID,
      destination: { q: 6, r: 2 },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("destination_unreachable");
  });

  it("advances initiative and refreshes the next unit movement", () => {
    const initial = createEncounterState();
    const result = processCommand(initial, {
      type: "battle.end_turn",
      battleId: SCHOOL_BATTLE_ID,
      unitId: ARCHER_UNIT_ID,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.battle.activeUnitId).toBe(LANCER_UNIT_ID);
    expect(result.state.battle.round).toBe(1);
    expect(result.state.battle.units[LANCER_UNIT_ID]?.remainingMovement).toBe(5);
  });
});
