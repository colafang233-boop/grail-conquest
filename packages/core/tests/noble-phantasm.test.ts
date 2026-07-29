import { describe, expect, it } from "vitest";
import {
  ARCHER_UNIT_ID,
  LANCER_UNIT_ID,
  RIN_UNIT_ID,
  SCHOOL_BATTLE_ID,
  TOHSAKA_FACTION_ID,
  createSchoolBattleState,
  processCommand,
  type GameState,
} from "../src";

function beginEncounter(): GameState {
  const started = processCommand(createSchoolBattleState(), { type: "scenario.begin_encounter" });
  if (!started.ok) throw new Error(started.error.message);
  return started.state;
}

function prepareLancer(): GameState {
  const initial = beginEncounter();
  const lancerTurn = {
    ...initial,
    battle: { ...initial.battle, round: 3, activeUnitId: LANCER_UNIT_ID },
  };
  const prepared = processCommand(lancerTurn, {
    type: "noble_phantasm.prepare",
    battleId: SCHOOL_BATTLE_ID,
    servantId: LANCER_UNIT_ID,
    targetId: RIN_UNIT_ID,
  });
  if (!prepared.ok) throw new Error(prepared.error.message);
  return prepared.state;
}

function readyLancer(): GameState {
  let state = prepareLancer();
  for (const unitId of [LANCER_UNIT_ID, RIN_UNIT_ID, ARCHER_UNIT_ID] as const) {
    const advanced = processCommand(state, {
      type: "battle.end_turn",
      battleId: SCHOOL_BATTLE_ID,
      unitId,
    });
    if (!advanced.ok) throw new Error(advanced.error.message);
    state = advanced.state;
  }
  return state;
}

describe("noble phantasm state machine", () => {
  it("locks a target and spends mana when preparation begins", () => {
    const state = prepareLancer();
    const lancer = state.battle.units[LANCER_UNIT_ID]!;
    expect(lancer.mana).toBe(62);
    expect(lancer.noblePhantasm?.phase).toBe("preparing");
    expect(lancer.noblePhantasm?.targetId).toBe(RIN_UNIT_ID);
    expect(state.scenario.phase).toBe("noble_phantasm_warning");
  });

  it("advances charge and becomes ready on the next Lancer turn", () => {
    const state = readyLancer();
    expect(state.battle.activeUnitId).toBe(LANCER_UNIT_ID);
    expect(state.battle.units[LANCER_UNIT_ID]?.noblePhantasm?.charge).toBe(1);
    expect(state.battle.units[LANCER_UNIT_ID]?.noblePhantasm?.phase).toBe("ready");
  });

  it("is interrupted by sufficient projected-shot damage", () => {
    const prepared = prepareLancer();
    const archerTurn = {
      ...prepared,
      battle: {
        ...prepared.battle,
        activeUnitId: ARCHER_UNIT_ID,
        units: {
          ...prepared.battle.units,
          [ARCHER_UNIT_ID]: {
            ...prepared.battle.units[ARCHER_UNIT_ID]!,
            mainActionAvailable: true,
          },
        },
      },
    };

    const result = processCommand(archerTurn, {
      type: "ability.use",
      battleId: SCHOOL_BATTLE_ID,
      actorId: ARCHER_UNIT_ID,
      abilityId: "archer_projected_shot",
      targetId: LANCER_UNIT_ID,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.battle.units[LANCER_UNIT_ID]?.noblePhantasm?.phase).toBe("cooldown");
    expect(result.state.battle.units[LANCER_UNIT_ID]?.noblePhantasm?.cooldownRemaining).toBe(1);
    expect(result.events.map(event => event.type)).toContain("noble_phantasm.interrupted");
  });

  it("is interrupted when the preparing Servant moves", () => {
    const prepared = prepareLancer();
    const movable = {
      ...prepared,
      battle: {
        ...prepared.battle,
        activeUnitId: LANCER_UNIT_ID,
        units: {
          ...prepared.battle.units,
          [LANCER_UNIT_ID]: {
            ...prepared.battle.units[LANCER_UNIT_ID]!,
            remainingMovement: 5,
          },
        },
      },
    };
    const result = processCommand(movable, {
      type: "battle.move_unit",
      battleId: SCHOOL_BATTLE_ID,
      unitId: LANCER_UNIT_ID,
      destination: { q: 5, r: 2 },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.battle.units[LANCER_UNIT_ID]?.noblePhantasm?.phase).toBe("cooldown");
    expect(result.events.map(event => event.type)).toContain("noble_phantasm.interrupted");
  });

  it("uses command-seal mana infusion to finish Archer preparation", () => {
    const initial = beginEncounter();
    const prepared = processCommand(initial, {
      type: "noble_phantasm.prepare",
      battleId: SCHOOL_BATTLE_ID,
      servantId: ARCHER_UNIT_ID,
      targetId: LANCER_UNIT_ID,
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.state.battle.units[ARCHER_UNIT_ID]?.noblePhantasm?.requiredCharge).toBe(2);

    const infused = processCommand(prepared.state, {
      type: "contract.use_command_seal",
      battleId: SCHOOL_BATTLE_ID,
      factionId: TOHSAKA_FACTION_ID,
      effect: "mana_infusion",
    });
    expect(infused.ok).toBe(true);
    if (!infused.ok) return;
    expect(infused.state.battle.units[ARCHER_UNIT_ID]?.noblePhantasm?.phase).toBe("ready");
    expect(infused.state.battle.units[ARCHER_UNIT_ID]?.noblePhantasm?.charge).toBe(2);
  });

  it("releases the Lancer noble phantasm and records a high-confidence clue", () => {
    const ready = readyLancer();
    const result = processCommand(ready, {
      type: "noble_phantasm.release",
      battleId: SCHOOL_BATTLE_ID,
      servantId: LANCER_UNIT_ID,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.events.map(event => event.type)).toContain("noble_phantasm.released");
    expect(result.state.scenario.clues.map(clue => clue.id)).toContain("true_name_release");
    expect(result.state.scenario.report?.candidates[0]?.name).toBe("库·丘林");
  });

  it("replays identical command sequences deterministically", () => {
    const run = () => {
      const initial = beginEncounter();
      return processCommand(initial, {
        type: "noble_phantasm.prepare",
        battleId: SCHOOL_BATTLE_ID,
        servantId: ARCHER_UNIT_ID,
        targetId: LANCER_UNIT_ID,
      });
    };
    const first = run();
    const second = run();
    expect(first).toEqual(second);
  });
});
