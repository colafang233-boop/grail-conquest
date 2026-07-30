import { describe, expect, it } from "vitest";
import {
  ARCHER_UNIT_ID,
  EMIYA_FACTION_ID,
  ENEMY_STRATEGY_FACTION_ID,
  RIN_UNIT_ID,
  SABER_UNIT_ID,
  STRATEGY_FACTION_ID,
  TOHSAKA_FACTION_ID,
  classifyDetection,
  createSchoolBattleState,
  determineAdvantage,
  processCommand,
  type GameState,
} from "../src";

function dispatch(state: GameState, command: Parameters<typeof processCommand>[1]): GameState {
  const result = processCommand(state, command);
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
}

function lockMoveToSchool(initial = createSchoolBattleState()): GameState {
  const submitted = dispatch(initial, { type: "operations.submit_order", orderType: "move", destinationId: "school" });
  return dispatch(submitted, { type: "operations.lock_orders" });
}

function resolveMoveToSchool(initial = createSchoolBattleState()) {
  const locked = lockMoveToSchool(initial);
  const result = processCommand(locked, { type: "operations.resolve_night" });
  if (!result.ok) throw new Error(result.error.message);
  return result;
}

function enterFirstEncounter(state: GameState): GameState {
  const encounter = state.strategy.encounterQueue[0];
  if (!encounter) throw new Error("Expected queued encounter");
  return dispatch(state, { type: "operations.enter_encounter", queueId: encounter.id });
}

describe("nightly operation cycle", () => {
  it("starts in planning with four hidden faction states", () => {
    const state = createSchoolBattleState();
    expect(state.schemaVersion).toBe(4);
    expect(state.strategy.phase).toBe("planning");
    expect(state.strategy.playerOrder).toBeUndefined();
    expect(state.strategy.enemyOrder).toBeUndefined();
    expect(Object.keys(state.strategy.factions)).toHaveLength(4);
    expect(state.strategy.factions[ENEMY_STRATEGY_FACTION_ID]?.regionId).toBe("fuyuki-bridge");
  });

  it("locks the player order and generates deterministic orders for every AI faction", () => {
    const locked = lockMoveToSchool();
    expect(locked.strategy.phase).toBe("orders_locked");
    expect(locked.strategy.playerOrder).toMatchObject({ type: "move", originRegionId: "tohsaka-residence", destinationRegionId: "school" });
    expect(locked.strategy.factions[ENEMY_STRATEGY_FACTION_ID]?.order?.destinationRegionId).toBe("school");
    expect(locked.strategy.factions[EMIYA_FACTION_ID]?.order?.destinationRegionId).toBe("school");
    expect(Object.values(locked.strategy.factions).filter(faction => faction.order)).toHaveLength(4);
  });

  it("resolves simultaneous movement and queues a multi-party school encounter", () => {
    const result = resolveMoveToSchool();
    expect(result.state.strategy.currentRegionId).toBe("school");
    expect(result.state.strategy.phase).toBe("encounter_resolution");
    expect(result.state.strategy.lastDetections.length).toBeGreaterThanOrEqual(3);
    const encounter = result.state.strategy.encounterQueue.find(item => item.regionId === "school");
    expect(encounter).toBeDefined();
    expect(encounter?.participantFactionIds.map(String).sort()).toEqual(["emiya", "lancer-faction", "tohsaka"]);
    expect(encounter?.hostilePairs).toContain("lancer-faction::tohsaka");
  });

  it("enters a generated encounter with only deployed participants in initiative", () => {
    const entered = enterFirstEncounter(resolveMoveToSchool().state);
    expect(entered.mode).toBe("battle");
    expect(entered.strategy.activeEncounterId).toBe("school-night");
    expect(entered.scenario.phase).toBe("encounter");
    expect(entered.battle.units[ARCHER_UNIT_ID]?.position).toEqual({ q: 1, r: 2 });
    expect(entered.battle.units[SABER_UNIT_ID]?.deployed).toBe(true);
    expect(entered.battle.initiative).toContain(SABER_UNIT_ID);
    expect(entered.battle.initiative).toContain(entered.battle.activeUnitId);
    expect(entered.battle.initiative.every(id => entered.battle.units[id]?.deployed)).toBe(true);
  });

  it("supports mutual, one-sided, and missed detection classifications", () => {
    expect(classifyDetection(true, true)).toBe("mutual");
    expect(classifyDetection(true, false)).toBe("player_only");
    expect(classifyDetection(false, true)).toBe("enemy_only");
    expect(classifyDetection(false, false)).toBe("missed");
    expect(determineAdvantage("mutual", "ambush", "move")).toBe("player");
    expect(determineAdvantage("mutual", "move", "ambush")).toBe("enemy");
  });

  it("converts workshop preparation into a barrier at encounter start", () => {
    const initial = createSchoolBattleState();
    const playerFaction = initial.strategy.factions[STRATEGY_FACTION_ID]!;
    const atControlledSchool: GameState = {
      ...initial,
      strategy: {
        ...initial.strategy,
        currentRegionId: "school",
        factions: {
          ...initial.strategy.factions,
          [STRATEGY_FACTION_ID]: { ...playerFaction, regionId: "school" },
        },
        regions: {
          ...initial.strategy.regions,
          school: { ...initial.strategy.regions.school, controlledBy: TOHSAKA_FACTION_ID },
        },
      },
    };

    let state = dispatch(atControlledSchool, { type: "operations.submit_order", orderType: "prepare_workshop" });
    state = dispatch(state, { type: "operations.lock_orders" });
    state = dispatch(state, { type: "operations.resolve_night" });
    state = enterFirstEncounter(state);

    expect(state.strategy.workshopPrepared).toBe(false);
    expect(state.battle.units[ARCHER_UNIT_ID]?.barrier).toBe(15);
  });

  it("returns a completed encounter to night settlement with consequences preserved", () => {
    const entered = enterFirstEncounter(resolveMoveToSchool().state);
    const warningState: GameState = {
      ...entered,
      scenario: {
        ...entered.scenario,
        phase: "noble_phantasm_warning",
        clues: [
          ...entered.scenario.clues,
          { id: "causality_reversal", category: "noble_phantasm", label: "因果逆转", confidence: 90, source: "test", discoveredAtSequence: entered.sequence + 1 },
        ],
      },
      battle: {
        ...entered.battle,
        units: {
          ...entered.battle.units,
          [ARCHER_UNIT_ID]: { ...entered.battle.units[ARCHER_UNIT_ID]!, health: 73, mana: 21 },
        },
      },
    };

    const retreated = dispatch(warningState, { type: "scenario.retreat" });
    expect(retreated.mode).toBe("strategy");
    expect(retreated.strategy.phase).toBe("night_settlement");
    expect(retreated.strategy.activeEncounterId).toBeUndefined();
    expect(retreated.strategy.completedEncounterIds).toContain("school-night");
    expect(retreated.battle.units[ARCHER_UNIT_ID]?.health).toBe(73);
    expect(retreated.battle.units[ARCHER_UNIT_ID]?.mana).toBe(21);
  });

  it("abstracts AI-only clashes and still settles a quiet player night", () => {
    let state = dispatch(createSchoolBattleState(), { type: "operations.submit_order", orderType: "rest" });
    state = dispatch(state, { type: "operations.lock_orders" });
    state = dispatch(state, { type: "operations.resolve_night" });
    expect(state.strategy.phase).toBe("night_settlement");
    expect(state.strategy.encounterQueue).toHaveLength(0);

    const settled = dispatch(state, { type: "operations.settle_night" });
    expect(settled.strategy.day).toBe(2);
    expect(settled.strategy.phase).toBe("planning");
    expect(settled.strategy.playerOrder).toBeUndefined();
    expect(settled.strategy.enemyOrder).toBeUndefined();
    expect(settled.battle.units[RIN_UNIT_ID]?.mana).toBe(100);
    expect(settled.battle.units[ARCHER_UNIT_ID]?.mana).toBe(88);
  });

  it("produces identical events and state for the same seed and commands", () => {
    const run = () => {
      const initial = createSchoolBattleState();
      const submitted = processCommand(initial, { type: "operations.submit_order" as const, orderType: "move" as const, destinationId: "school" as const });
      if (!submitted.ok) throw new Error(submitted.error.message);
      const locked = processCommand(submitted.state, { type: "operations.lock_orders" as const });
      if (!locked.ok) throw new Error(locked.error.message);
      const resolved = processCommand(locked.state, { type: "operations.resolve_night" as const });
      if (!resolved.ok) throw new Error(resolved.error.message);
      return { events: [...submitted.events, ...locked.events, ...resolved.events], state: resolved.state };
    };

    const first = run();
    const second = run();
    expect(first.events).toEqual(second.events);
    expect(first.state).toEqual(second.state);
  });
});
