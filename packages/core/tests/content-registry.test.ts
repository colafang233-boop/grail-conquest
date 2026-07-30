import { describe, expect, it } from "vitest";
import {
  createContentRegistry,
  createNewGameState,
  validateContentRegistry,
  type AbilityId,
  type ContentRegistry,
} from "../src";

describe("content registry", () => {
  it("validates all built-in campaign content", () => {
    const result = validateContentRegistry(createContentRegistry(createNewGameState()));
    expect(result.valid).toBe(true);
    expect(result.diagnostics.filter(item => item.severity === "error")).toEqual([]);
  });

  it("reports readable diagnostics for broken references", () => {
    const registry = createContentRegistry(createNewGameState());
    const archer = registry.units.archer;
    if (!archer) throw new Error("Missing Archer fixture");
    const broken: ContentRegistry = {
      ...registry,
      units: {
        ...registry.units,
        archer: {
          ...archer,
          abilityIds: [...archer.abilityIds, "missing_ability" as AbilityId],
        },
      },
    };
    const result = validateContentRegistry(broken);
    expect(result.valid).toBe(false);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: "unit.ability_missing",
      path: "units.archer.abilityIds",
    }));
  });
});
