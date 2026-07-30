import { describe, expect, it } from "vitest";
import {
  RYOUDOU_FACTION_ID,
  STRATEGY_FACTION_ID,
  areFactionsHostile,
  createSchoolBattleState,
  processCommand,
} from "../src";

describe("strategic diplomacy", () => {
  it("changes encounter hostility when a truce is accepted and broken", () => {
    const initial = createSchoolBattleState();
    expect(areFactionsHostile(initial, STRATEGY_FACTION_ID, RYOUDOU_FACTION_ID)).toBe(true);

    const offered = processCommand(initial, {
      type: "diplomacy.offer",
      targetFactionId: RYOUDOU_FACTION_ID,
      proposedStatus: "truce",
      durationDays: 2,
    });
    expect(offered.ok).toBe(true);
    if (!offered.ok) return;
    expect(areFactionsHostile(offered.state, STRATEGY_FACTION_ID, RYOUDOU_FACTION_ID)).toBe(false);

    const broken = processCommand(offered.state, {
      type: "diplomacy.break",
      targetFactionId: RYOUDOU_FACTION_ID,
    });
    expect(broken.ok).toBe(true);
    if (!broken.ok) return;
    expect(areFactionsHostile(broken.state, STRATEGY_FACTION_ID, RYOUDOU_FACTION_ID)).toBe(true);
  });
});
