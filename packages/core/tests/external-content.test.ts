import { describe, expect, it } from "vitest";
import {
  createScenarioPreviewState,
  createSchoolBattleState,
  mergeExternalContentPacks,
  validateExternalContentPack,
  type BrowserContentPack,
} from "../src";

const basePack: BrowserContentPack = {
  schemaVersion: 1,
  id: "test-base",
  version: "1.0.0",
  priority: 0,
  routes: [],
  regions: [
    { id: "school", name: "School", x: 100, y: 100, connections: ["fuyuki-bridge"], leylineStrength: 1, encounterId: "school-night" },
    { id: "fuyuki-bridge", name: "Bridge", x: 200, y: 100, connections: ["school"], leylineStrength: 2 },
  ],
  encounters: [
    { id: "school-night", title: "Preview", subtitle: "Test", objective: "Survive", regionId: "school", playerStart: { q: 0, r: 1 }, enemyStart: { q: 7, r: 1 } },
  ],
  dialogues: {},
};

describe("external browser content", () => {
  it("validates cross references and reports readable fixes", () => {
    const valid = validateExternalContentPack(basePack, "fixture.json");
    expect(valid.valid).toBe(true);

    const invalid = validateExternalContentPack({
      ...basePack,
      regions: [{ ...basePack.regions[0], connections: ["missing"] }],
    }, "broken.json");
    expect(invalid.valid).toBe(false);
    expect(invalid.diagnostics).toContainEqual(expect.objectContaining({
      source: "broken.json",
      code: "region.connection_missing",
      suggestedFix: expect.any(String),
    }));
  });

  it("merges override packs in deterministic priority order", () => {
    const low = { ...basePack, id: "low", priority: 10, version: "1.1.0", encounters: [{ ...basePack.encounters[0]!, title: "Low" }] };
    const high = { ...basePack, id: "high", priority: 20, version: "1.2.0", encounters: [{ ...basePack.encounters[0]!, title: "High" }] };
    const first = mergeExternalContentPacks(basePack, [high, low]);
    const second = mergeExternalContentPacks(basePack, [low, high]);
    expect(first.pack).toEqual(second.pack);
    expect(first.pack.encounters[0]?.title).toBe("High");
  });

  it("creates an isolated playable preview without mutating the campaign state", () => {
    const initial = createSchoolBattleState();
    const result = createScenarioPreviewState(initial, basePack, "school-night");
    expect(result.error).toBeUndefined();
    expect(result.state?.mode).toBe("battle");
    expect(result.state?.scenario.objective).toBe("Survive");
    expect(result.state?.battle.units.archer?.position).toEqual({ q: 0, r: 1 });
    expect(initial.mode).toBe("strategy");
  });
});
