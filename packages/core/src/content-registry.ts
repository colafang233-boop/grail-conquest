import { ABILITY_DEFINITIONS, type AbilityDefinition } from "./abilities";
import { CAMPAIGN_ROUTE_DEFINITIONS, type CampaignRouteDefinition } from "./campaign";
import { NOBLE_PHANTASM_DEFINITIONS, type NoblePhantasmDefinition } from "./noble-phantasms";
import { ENCOUNTER_DEFINITIONS, type EncounterDefinition } from "./strategy";
import type {
  AbilityId,
  BattleUnitState,
  CampaignRouteId,
  EncounterId,
  GameState,
  RegionId,
  StrategyRegionState,
} from "./state";

export interface ContentDiagnostic {
  readonly severity: "error" | "warning";
  readonly code: string;
  readonly message: string;
  readonly path: string;
}

export interface ContentRegistry {
  readonly routes: Readonly<Record<CampaignRouteId, CampaignRouteDefinition>>;
  readonly abilities: Readonly<Record<AbilityId, AbilityDefinition>>;
  readonly noblePhantasms: Readonly<Record<string, NoblePhantasmDefinition>>;
  readonly regions: Readonly<Record<RegionId, StrategyRegionState>>;
  readonly encounters: Readonly<Record<EncounterId, EncounterDefinition>>;
  readonly units: Readonly<Record<string, BattleUnitState>>;
}

export interface ContentValidationResult {
  readonly valid: boolean;
  readonly diagnostics: readonly ContentDiagnostic[];
}

export function createContentRegistry(state: GameState): ContentRegistry {
  return {
    routes: CAMPAIGN_ROUTE_DEFINITIONS,
    abilities: ABILITY_DEFINITIONS,
    noblePhantasms: NOBLE_PHANTASM_DEFINITIONS,
    regions: state.strategy.regions,
    encounters: ENCOUNTER_DEFINITIONS,
    units: state.battle.units,
  };
}

export function validateContentRegistry(registry: ContentRegistry): ContentValidationResult {
  const diagnostics: ContentDiagnostic[] = [];
  const factionIds = new Set(Object.values(registry.units).map(unit => String(unit.factionId)));

  for (const route of Object.values(registry.routes)) {
    if (!factionIds.has(String(route.playerFactionId))) {
      diagnostics.push(error(
        "route.faction_missing",
        `Route ${route.id} references missing faction ${route.playerFactionId}`,
        `routes.${route.id}.playerFactionId`,
      ));
    }
    if (route.objectives.length !== 3) {
      diagnostics.push(warning(
        "route.objective_count",
        `Route ${route.id} should contain exactly three mini-campaign objectives`,
        `routes.${route.id}.objectives`,
      ));
    }
  }

  for (const unit of Object.values(registry.units)) {
    for (const abilityId of unit.abilityIds) {
      if (!registry.abilities[abilityId]) {
        diagnostics.push(error(
          "unit.ability_missing",
          `${unit.name} references unknown ability ${abilityId}`,
          `units.${unit.id}.abilityIds`,
        ));
      }
    }
    const nobleId = unit.noblePhantasm?.definitionId;
    if (nobleId && !registry.noblePhantasms[nobleId]) {
      diagnostics.push(error(
        "unit.noble_phantasm_missing",
        `${unit.name} references unknown noble phantasm ${nobleId}`,
        `units.${unit.id}.noblePhantasm`,
      ));
    }
  }

  for (const region of Object.values(registry.regions)) {
    for (const connection of region.connections) {
      if (!registry.regions[connection]) {
        diagnostics.push(error(
          "region.connection_missing",
          `${region.name} connects to unknown region ${connection}`,
          `regions.${region.id}.connections`,
        ));
      }
    }
    if (region.encounterId && !registry.encounters[region.encounterId]) {
      diagnostics.push(error(
        "region.encounter_missing",
        `${region.name} references unknown encounter ${region.encounterId}`,
        `regions.${region.id}.encounterId`,
      ));
    }
  }

  for (const encounter of Object.values(registry.encounters)) {
    if (!registry.regions[encounter.regionId]) {
      diagnostics.push(error(
        "encounter.region_missing",
        `${encounter.title} references unknown region ${encounter.regionId}`,
        `encounters.${encounter.id}.regionId`,
      ));
    }
  }

  for (const ability of Object.values(registry.abilities)) {
    if (ability.manaCost < 0 || ability.range < 0) {
      diagnostics.push(error(
        "ability.value_invalid",
        `${ability.name} contains a negative cost or range`,
        `abilities.${ability.id}`,
      ));
    }
  }

  return {
    valid: diagnostics.every(item => item.severity !== "error"),
    diagnostics,
  };
}

export function assertValidContentRegistry(state: GameState): void {
  const result = validateContentRegistry(createContentRegistry(state));
  if (result.valid) return;
  const details = result.diagnostics
    .filter(item => item.severity === "error")
    .map(item => `[${item.code}] ${item.path}: ${item.message}`)
    .join("\n");
  throw new Error(`Content registry validation failed:\n${details}`);
}

function error(code: string, message: string, path: string): ContentDiagnostic {
  return { severity: "error", code, message, path };
}

function warning(code: string, message: string, path: string): ContentDiagnostic {
  return { severity: "warning", code, message, path };
}
