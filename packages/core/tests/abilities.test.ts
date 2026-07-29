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

describe("authored abilities", () => {
  it("uses projected shot with deterministic damage and mana cost", () => {
    const result = processCommand(beginEncounter(), {
      type: "ability.use",
      battleId: SCHOOL_BATTLE_ID,
      actorId: ARCHER_UNIT_ID,
      abilityId: "archer_projected_shot",
      targetId: LANCER_UNIT_ID,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.battle.units[ARCHER_UNIT_ID]?.mana).toBe(68);
    expect(result.state.battle.units[LANCER_UNIT_ID]?.health).toBe(111);
    expect(result.events.map(event => event.type)).toContain("ability.used");
  });

  it("applies a projected shield that absorbs the next attack", () => {
    const initial = beginEncounter();
    const shielded = processCommand(initial, {
      type: "ability.use",
      battleId: SCHOOL_BATTLE_ID,
      actorId: ARCHER_UNIT_ID,
      abilityId: "archer_projected_shield",
      targetId: RIN_UNIT_ID,
    });
    expect(shielded.ok).toBe(true);
    if (!shielded.ok) return;
    expect(shielded.state.battle.units[RIN_UNIT_ID]?.barrier).toBe(36);

    const threatened = {
      ...shielded.state,
      battle: {
        ...shielded.state.battle,
        activeUnitId: LANCER_UNIT_ID,
        units: {
          ...shielded.state.battle.units,
          [LANCER_UNIT_ID]: {
            ...shielded.state.battle.units[LANCER_UNIT_ID]!,
            position: { q: 1, r: 4 },
            mainActionAvailable: true,
          },
          [ARCHER_UNIT_ID]: {
            ...shielded.state.battle.units[ARCHER_UNIT_ID]!,
            reactionAvailable: false,
          },
        },
      },
    };

    const attacked = processCommand(threatened, {
      type: "battle.attack_unit",
      battleId: SCHOOL_BATTLE_ID,
      attackerId: LANCER_UNIT_ID,
      targetId: RIN_UNIT_ID,
    });
    expect(attacked.ok).toBe(true);
    if (!attacked.ok) return;
    expect(attacked.state.battle.units[RIN_UNIT_ID]?.health).toBe(60);
    expect(attacked.state.battle.units[RIN_UNIT_ID]?.barrier).toBe(6);
    expect(attacked.events.map(event => event.type)).toContain("battle.barrier_absorbed");
  });

  it("restores Archer guard support and extends the guard range", () => {
    const initial = beginEncounter();
    const spent = {
      ...initial,
      battle: {
        ...initial.battle,
        units: {
          ...initial.battle.units,
          [ARCHER_UNIT_ID]: {
            ...initial.battle.units[ARCHER_UNIT_ID]!,
            reactionAvailable: false,
          },
        },
      },
    };

    const result = processCommand(spent, {
      type: "ability.use",
      battleId: SCHOOL_BATTLE_ID,
      actorId: ARCHER_UNIT_ID,
      abilityId: "archer_guard_support",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.battle.units[ARCHER_UNIT_ID]?.reactionAvailable).toBe(true);
    expect(result.state.battle.units[ARCHER_UNIT_ID]?.guardBonus).toBe(1);
  });

  it("moves Lancer beside the target with high-speed thrust", () => {
    const initial = beginEncounter();
    const lancerTurn = {
      ...initial,
      battle: {
        ...initial.battle,
        activeUnitId: LANCER_UNIT_ID,
        units: {
          ...initial.battle.units,
          [LANCER_UNIT_ID]: {
            ...initial.battle.units[LANCER_UNIT_ID]!,
            position: { q: 2, r: 3 },
          },
        },
      },
    };

    const result = processCommand(lancerTurn, {
      type: "ability.use",
      battleId: SCHOOL_BATTLE_ID,
      actorId: LANCER_UNIT_ID,
      abilityId: "lancer_high_speed_thrust",
      targetId: RIN_UNIT_ID,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.events.map(event => event.type)).toContain("battle.unit_displaced");
    expect(result.state.battle.units[RIN_UNIT_ID]?.health).toBeLessThan(60);
  });

  it("uses battle continuation to survive lethal damage", () => {
    const initial = beginEncounter();
    const lancerTurn = {
      ...initial,
      battle: { ...initial.battle, activeUnitId: LANCER_UNIT_ID },
    };
    const prepared = processCommand(lancerTurn, {
      type: "ability.use",
      battleId: SCHOOL_BATTLE_ID,
      actorId: LANCER_UNIT_ID,
      abilityId: "lancer_battle_continuation",
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;

    const lethal = {
      ...prepared.state,
      battle: {
        ...prepared.state.battle,
        activeUnitId: ARCHER_UNIT_ID,
        units: {
          ...prepared.state.battle.units,
          [ARCHER_UNIT_ID]: {
            ...prepared.state.battle.units[ARCHER_UNIT_ID]!,
            attackPower: 999,
            mainActionAvailable: true,
          },
        },
      },
    };
    const result = processCommand(lethal, {
      type: "battle.attack_unit",
      battleId: SCHOOL_BATTLE_ID,
      attackerId: ARCHER_UNIT_ID,
      targetId: LANCER_UNIT_ID,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.battle.units[LANCER_UNIT_ID]?.health).toBe(1);
    expect(result.state.battle.units[LANCER_UNIT_ID]?.defeated).toBe(false);
    expect(result.events.map(event => event.type)).toContain("ability.battle_continuation_triggered");
  });

  it("damages every adjacent enemy with sweeping strike", () => {
    const initial = beginEncounter();
    const surrounded = {
      ...initial,
      battle: {
        ...initial.battle,
        activeUnitId: LANCER_UNIT_ID,
        units: {
          ...initial.battle.units,
          [LANCER_UNIT_ID]: { ...initial.battle.units[LANCER_UNIT_ID]!, position: { q: 1, r: 3 } },
          [ARCHER_UNIT_ID]: { ...initial.battle.units[ARCHER_UNIT_ID]!, position: { q: 1, r: 2 } },
          [RIN_UNIT_ID]: { ...initial.battle.units[RIN_UNIT_ID]!, position: { q: 0, r: 4 } },
        },
      },
    };

    const result = processCommand(surrounded, {
      type: "ability.use",
      battleId: SCHOOL_BATTLE_ID,
      actorId: LANCER_UNIT_ID,
      abilityId: "lancer_sweeping_strike",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.battle.units[ARCHER_UNIT_ID]?.health).toBeLessThan(120);
    expect(result.state.battle.units[RIN_UNIT_ID]?.health).toBeLessThan(60);
    expect(result.events.filter(event => event.type === "battle.damage_dealt")).toHaveLength(2);
  });
});
