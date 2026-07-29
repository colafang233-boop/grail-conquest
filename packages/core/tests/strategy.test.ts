import { describe, expect, it } from "vitest";
import {
  ARCHER_UNIT_ID,
  RIN_UNIT_ID,
  TOHSAKA_FACTION_ID,
  createSchoolBattleState,
  processCommand,
} from "../src";

function moveToSchool() {
  const moved = processCommand(createSchoolBattleState(), {
    type: "strategy.move_region",
    destinationId: "school",
  });
  if (!moved.ok) throw new Error(moved.error.message);
  return moved.state;
}

function prepareSchoolEncounter() {
  const investigated = processCommand(moveToSchool(), { type: "strategy.investigate" });
  if (!investigated.ok) throw new Error(investigated.error.message);
  return investigated.state;
}

function enterSchoolEncounter() {
  const entered = processCommand(prepareSchoolEncounter(), { type: "strategy.enter_encounter" });
  if (!entered.ok) throw new Error(entered.error.message);
  return entered.state;
}

describe("Fuyuki strategic layer", () => {
  it("starts at the Tohsaka residence with three action points", () => {
    const state = createSchoolBattleState();
    expect(state.mode).toBe("strategy");
    expect(state.strategy.currentRegionId).toBe("tohsaka-residence");
    expect(state.strategy.actionPoints).toBe(3);
    expect(state.strategy.regions["fuyuki-bridge"].discovered).toBe(false);
  });

  it("moves only along connected routes and spends one action point", () => {
    const moved = processCommand(createSchoolBattleState(), {
      type: "strategy.move_region",
      destinationId: "school",
    });
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    expect(moved.state.strategy.currentRegionId).toBe("school");
    expect(moved.state.strategy.actionPoints).toBe(2);

    const illegal = processCommand(moved.state, {
      type: "strategy.move_region",
      destinationId: "harbor",
    });
    expect(illegal.ok).toBe(false);
    if (illegal.ok) return;
    expect(illegal.error.code).toBe("strategy_region_not_connected");
  });

  it("investigates the school and prepares the existing encounter", () => {
    const prepared = prepareSchoolEncounter();
    expect(prepared.strategy.actionPoints).toBe(1);
    expect(prepared.strategy.regions.school.investigated).toBe(true);
    expect(prepared.strategy.pendingEncounterId).toBe("school-night");

    const entered = processCommand(prepared, { type: "strategy.enter_encounter" });
    expect(entered.ok).toBe(true);
    if (!entered.ok) return;
    expect(entered.state.mode).toBe("battle");
    expect(entered.state.scenario.phase).toBe("encounter");
    expect(entered.state.scenario.clues.map(clue => clue.id)).toContain("lancer_class");
  });

  it("collects mana income from controlled leylines at the next day", () => {
    const initial = createSchoolBattleState();
    const drained = {
      ...initial,
      battle: {
        ...initial.battle,
        units: {
          ...initial.battle.units,
          [RIN_UNIT_ID]: { ...initial.battle.units[RIN_UNIT_ID]!, mana: 40 },
          [ARCHER_UNIT_ID]: { ...initial.battle.units[ARCHER_UNIT_ID]!, mana: 30 },
        },
      },
    };
    const ended = processCommand(drained, { type: "strategy.end_day" });
    expect(ended.ok).toBe(true);
    if (!ended.ok) return;
    expect(ended.state.strategy.day).toBe(2);
    expect(ended.state.strategy.actionPoints).toBe(3);
    expect(ended.state.battle.units[RIN_UNIT_ID]?.mana).toBe(50);
    expect(ended.state.battle.units[ARCHER_UNIT_ID]?.mana).toBe(46);
  });

  it("rests at a safe region and preserves deterministic limits", () => {
    const initial = createSchoolBattleState();
    const wounded = {
      ...initial,
      battle: {
        ...initial.battle,
        units: {
          ...initial.battle.units,
          [RIN_UNIT_ID]: { ...initial.battle.units[RIN_UNIT_ID]!, health: 35, mana: 60 },
          [ARCHER_UNIT_ID]: { ...initial.battle.units[ARCHER_UNIT_ID]!, health: 70, mana: 50 },
        },
      },
    };
    const rested = processCommand(wounded, { type: "strategy.rest" });
    expect(rested.ok).toBe(true);
    if (!rested.ok) return;
    expect(rested.state.strategy.actionPoints).toBe(2);
    expect(rested.state.battle.units[RIN_UNIT_ID]?.health).toBe(47);
    expect(rested.state.battle.units[RIN_UNIT_ID]?.mana).toBe(80);
    expect(rested.state.battle.units[ARCHER_UNIT_ID]?.health).toBe(82);
    expect(rested.state.battle.units[ARCHER_UNIT_ID]?.mana).toBe(65);
  });

  it("returns from school night with combat consequences and intelligence preserved", () => {
    const encounter = enterSchoolEncounter();
    const altered = {
      ...encounter,
      scenario: {
        ...encounter.scenario,
        phase: "noble_phantasm_warning" as const,
        clues: [
          ...encounter.scenario.clues,
          {
            id: "causality_reversal",
            category: "noble_phantasm" as const,
            label: "因果逆转",
            confidence: 90,
            source: "test",
            discoveredAtSequence: encounter.sequence + 1,
          },
        ],
      },
      battle: {
        ...encounter.battle,
        units: {
          ...encounter.battle.units,
          [ARCHER_UNIT_ID]: { ...encounter.battle.units[ARCHER_UNIT_ID]!, health: 71, mana: 22 },
        },
        contracts: {
          ...encounter.battle.contracts,
          [TOHSAKA_FACTION_ID]: {
            ...encounter.battle.contracts[TOHSAKA_FACTION_ID]!,
            commandSeals: 2,
          },
        },
      },
    };

    const retreated = processCommand(altered, { type: "scenario.retreat" });
    expect(retreated.ok).toBe(true);
    if (!retreated.ok) return;
    expect(retreated.state.mode).toBe("strategy");
    expect(retreated.state.strategy.currentRegionId).toBe("school");
    expect(retreated.state.strategy.completedEncounterIds).toContain("school-night");
    expect(retreated.state.strategy.lastReport?.candidates[0]?.name).toBe("库·丘林");
    expect(retreated.state.battle.units[ARCHER_UNIT_ID]?.health).toBe(71);
    expect(retreated.state.battle.units[ARCHER_UNIT_ID]?.mana).toBe(22);
    expect(retreated.state.battle.contracts[TOHSAKA_FACTION_ID]?.commandSeals).toBe(2);
    expect(retreated.state.scenario.clues.map(clue => clue.id)).toContain("causality_reversal");
    expect(retreated.events.at(-1)?.type).toBe("strategy.returned");
  });
});
