import { describe, expect, it } from "vitest";
import {
  ARCHER_UNIT_ID,
  CASTER_UNIT_ID,
  EMIYA_FACTION_ID,
  ENEMY_STRATEGY_FACTION_ID,
  LANCER_UNIT_ID,
  RYOUDOU_FACTION_ID,
  SABER_UNIT_ID,
  STRATEGY_FACTION_ID,
  createSchoolBattleState,
  diplomacyKey,
  processCommand,
  type GameState,
} from "../src";

function dispatch(state: GameState, command: Parameters<typeof processCommand>[1]): GameState {
  const result = processCommand(state, command);
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
}

function resolvedSchoolContact(initial = createSchoolBattleState()): GameState {
  let state = dispatch(initial, { type: "operations.submit_order", orderType: "move", destinationId: "school" });
  state = dispatch(state, { type: "operations.lock_orders" });
  return dispatch(state, { type: "operations.resolve_night" });
}

describe("multi-faction Holy Grail War", () => {
  it("registers Tohsaka, Lancer, Emiya, and Ryudou factions", () => {
    const state = createSchoolBattleState();
    expect(state.schemaVersion).toBe(5);
    expect(Object.keys(state.strategy.factions).sort()).toEqual([
      "emiya",
      "lancer-faction",
      "ryudou",
      "tohsaka",
    ]);
    expect(state.strategy.factions[RYOUDOU_FACTION_ID]?.workshopLevel).toBe(2);
    expect(state.battle.units[SABER_UNIT_ID]?.deployed).toBe(false);
    expect(state.battle.units[CASTER_UNIT_ID]?.abilityIds).toContain("caster_mana_drain");
  });

  it("generates hidden orders for every active AI faction", () => {
    let state = dispatch(createSchoolBattleState(), {
      type: "operations.submit_order",
      orderType: "move",
      destinationId: "school",
    });
    state = dispatch(state, { type: "operations.lock_orders" });

    expect(state.strategy.factions[STRATEGY_FACTION_ID]?.order?.destinationRegionId).toBe("school");
    expect(state.strategy.factions[EMIYA_FACTION_ID]?.order?.destinationRegionId).toBe("school");
    expect(state.strategy.factions[ENEMY_STRATEGY_FACTION_ID]?.order?.destinationRegionId).toBe("school");
    expect(state.strategy.factions[RYOUDOU_FACTION_ID]?.order?.type).toBe("prepare_workshop");
  });

  it("creates a three-party school contact with two hostile pairs", () => {
    const state = resolvedSchoolContact();
    const encounter = state.strategy.encounterQueue.find(item => item.regionId === "school");
    expect(encounter).toBeDefined();
    expect(encounter?.participantFactionIds.map(String).sort()).toEqual([
      "emiya",
      "lancer-faction",
      "tohsaka",
    ]);
    expect([...encounter?.hostilePairs ?? []].sort()).toEqual([
      "emiya::lancer-faction",
      "lancer-faction::tohsaka",
    ]);
  });

  it("accepts an Emiya alliance and enables shared detection", () => {
    const state = dispatch(createSchoolBattleState(), {
      type: "diplomacy.offer",
      targetFactionId: EMIYA_FACTION_ID,
      proposedStatus: "allied",
      durationDays: 2,
    });
    const relation = state.strategy.diplomacy[diplomacyKey(STRATEGY_FACTION_ID, EMIYA_FACTION_ID)];
    expect(relation?.status).toBe("allied");
    expect(relation?.sharedDetection).toBe(true);
    expect(relation?.expiresDay).toBe(3);
  });

  it("marks a deliberately broken agreement as betrayal", () => {
    let state = dispatch(createSchoolBattleState(), {
      type: "diplomacy.offer",
      targetFactionId: EMIYA_FACTION_ID,
      proposedStatus: "truce",
      durationDays: 2,
    });
    state = dispatch(state, { type: "diplomacy.break", targetFactionId: EMIYA_FACTION_ID });
    const relation = state.strategy.diplomacy[diplomacyKey(STRATEGY_FACTION_ID, EMIYA_FACTION_ID)];
    expect(relation?.status).toBe("betrayed");
    expect(relation?.betrayalCount).toBe(1);
  });

  it("deploys every participant and rebuilds initiative for a multi-party battle", () => {
    const resolved = resolvedSchoolContact();
    const encounter = resolved.strategy.encounterQueue.find(item => item.regionId === "school");
    if (!encounter) throw new Error("Expected school encounter");
    const entered = dispatch(resolved, { type: "operations.enter_encounter", queueId: encounter.id });

    expect(entered.mode).toBe("battle");
    expect(entered.battle.units[ARCHER_UNIT_ID]?.deployed).toBe(true);
    expect(entered.battle.units[LANCER_UNIT_ID]?.deployed).toBe(true);
    expect(entered.battle.units[SABER_UNIT_ID]?.deployed).toBe(true);
    expect(entered.battle.units[CASTER_UNIT_ID]?.deployed).toBe(false);
    expect(entered.battle.initiative).toContain(SABER_UNIT_ID);
    expect(entered.battle.initiative.every(id => entered.battle.units[id]?.deployed)).toBe(true);
  });

  it("lets Caster drain mana through ordinary domain events", () => {
    const initial = createSchoolBattleState();
    const caster = initial.battle.units[CASTER_UNIT_ID]!;
    const archer = initial.battle.units[ARCHER_UNIT_ID]!;
    const battleState: GameState = {
      ...initial,
      mode: "battle",
      scenario: { ...initial.scenario, phase: "encounter" },
      battle: {
        ...initial.battle,
        activeUnitId: CASTER_UNIT_ID,
        initiative: [CASTER_UNIT_ID, ARCHER_UNIT_ID],
        participatingFactionIds: [RYOUDOU_FACTION_ID, STRATEGY_FACTION_ID],
        units: {
          ...initial.battle.units,
          [CASTER_UNIT_ID]: { ...caster, deployed: true, position: { q: 2, r: 2 }, mana: 80 },
          [ARCHER_UNIT_ID]: { ...archer, deployed: true, position: { q: 4, r: 2 }, mana: 60 },
        },
      },
      strategy: {
        ...initial.strategy,
        activeParticipantFactionIds: [RYOUDOU_FACTION_ID, STRATEGY_FACTION_ID],
      },
    };

    const result = processCommand(battleState, {
      type: "ability.use",
      battleId: battleState.battle.id,
      actorId: CASTER_UNIT_ID,
      abilityId: "caster_mana_drain",
      targetId: ARCHER_UNIT_ID,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.battle.units[ARCHER_UNIT_ID]?.mana).toBe(42);
    expect(result.state.battle.units[CASTER_UNIT_ID]?.mana).toBe(86);
    expect(result.events.map(event => event.type)).toContain("contract.mana_restored");
  });

  it("issues a church bounty against a highly exposed faction", () => {
    const initial = createSchoolBattleState();
    const lancer = initial.strategy.factions[ENEMY_STRATEGY_FACTION_ID]!;
    let state: GameState = {
      ...initial,
      strategy: {
        ...initial.strategy,
        factions: {
          ...initial.strategy.factions,
          [ENEMY_STRATEGY_FACTION_ID]: { ...lancer, exposure: 90 },
        },
      },
    };
    state = dispatch(state, { type: "operations.submit_order", orderType: "rest" });
    state = dispatch(state, { type: "operations.lock_orders" });
    state = dispatch(state, { type: "operations.resolve_night" });
    expect(state.strategy.churchBounty?.targetFactionId).toBe(ENEMY_STRATEGY_FACTION_ID);
    expect(state.strategy.churchBounty?.active).toBe(true);
  });
});
