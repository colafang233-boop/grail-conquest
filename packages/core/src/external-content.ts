import type { EncounterId, RegionId } from "./state";

export interface ExternalRouteContent {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly playerFactionId: string;
  readonly homeRegionId: string;
  readonly objectives: readonly {
    readonly id: string;
    readonly label: string;
    readonly description: string;
  }[];
}

export interface ExternalRegionContent {
  readonly id: string;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly connections: readonly string[];
  readonly leylineStrength: number;
  readonly encounterId?: string;
}

export interface ExternalEncounterContent {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly objective: string;
  readonly regionId: string;
  readonly playerStart: { readonly q: number; readonly r: number };
  readonly enemyStart: { readonly q: number; readonly r: number };
}

export interface BrowserContentPack {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly version: string;
  readonly priority: number;
  readonly routes: readonly ExternalRouteContent[];
  readonly regions: readonly ExternalRegionContent[];
  readonly encounters: readonly ExternalEncounterContent[];
  readonly dialogues: Readonly<Record<string, readonly string[]>>;
}

export interface ExternalContentDiagnostic {
  readonly source: string;
  readonly severity: "error" | "warning";
  readonly code: string;
  readonly path: string;
  readonly message: string;
  readonly suggestedFix: string;
}

export interface ExternalContentValidationResult {
  readonly valid: boolean;
  readonly diagnostics: readonly ExternalContentDiagnostic[];
  readonly pack?: BrowserContentPack;
}

export interface ExternalContentMergeResult {
  readonly pack: BrowserContentPack;
  readonly diagnostics: readonly ExternalContentDiagnostic[];
}

export function validateExternalContentPack(
  value: unknown,
  source = "memory",
): ExternalContentValidationResult {
  const diagnostics: ExternalContentDiagnostic[] = [];

  if (!isRecord(value)) {
    return invalid(source, "pack.object_required", "$", "Content pack must be an object", "Export a JSON object containing schemaVersion, id, version, routes, regions, and encounters.");
  }

  if (value.schemaVersion !== 1) {
    diagnostics.push(error(source, "pack.schema_version", "schemaVersion", "Only content-pack schemaVersion 1 is supported", "Set schemaVersion to 1."));
  }
  if (!isNonEmptyString(value.id)) {
    diagnostics.push(error(source, "pack.id_required", "id", "Content pack id is required", "Provide a stable lowercase id such as base-fuyuki."));
  }
  if (!isNonEmptyString(value.version)) {
    diagnostics.push(error(source, "pack.version_required", "version", "Content pack version is required", "Provide a version such as 1.0.0."));
  }
  if (!Array.isArray(value.routes)) diagnostics.push(error(source, "pack.routes_array", "routes", "routes must be an array", "Provide a routes array."));
  if (!Array.isArray(value.regions)) diagnostics.push(error(source, "pack.regions_array", "regions", "regions must be an array", "Provide a regions array."));
  if (!Array.isArray(value.encounters)) diagnostics.push(error(source, "pack.encounters_array", "encounters", "encounters must be an array", "Provide an encounters array."));

  if (diagnostics.some(item => item.severity === "error")) {
    return { valid: false, diagnostics };
  }

  const routes = parseRoutes(value.routes as unknown[], source, diagnostics);
  const regions = parseRegions(value.regions as unknown[], source, diagnostics);
  const encounters = parseEncounters(value.encounters as unknown[], source, diagnostics);
  const dialogues = parseDialogues(value.dialogues, source, diagnostics);
  const priority = typeof value.priority === "number" && Number.isFinite(value.priority)
    ? Math.trunc(value.priority)
    : 0;

  validateUniqueIds(routes, "routes", source, diagnostics);
  validateUniqueIds(regions, "regions", source, diagnostics);
  validateUniqueIds(encounters, "encounters", source, diagnostics);

  const regionIds = new Set(regions.map(item => item.id));
  const encounterIds = new Set(encounters.map(item => item.id));
  for (const region of regions) {
    for (const connection of region.connections) {
      if (!regionIds.has(connection)) {
        diagnostics.push(error(source, "region.connection_missing", `regions.${region.id}.connections`, `${region.name} references unknown region ${connection}`, "Add the region or remove the connection."));
      }
    }
    if (region.encounterId && !encounterIds.has(region.encounterId)) {
      diagnostics.push(error(source, "region.encounter_missing", `regions.${region.id}.encounterId`, `${region.name} references unknown encounter ${region.encounterId}`, "Add the encounter or clear encounterId."));
    }
  }
  for (const encounter of encounters) {
    if (!regionIds.has(encounter.regionId)) {
      diagnostics.push(error(source, "encounter.region_missing", `encounters.${encounter.id}.regionId`, `${encounter.title} references unknown region ${encounter.regionId}`, "Point the encounter to an existing region."));
    }
  }
  for (const route of routes) {
    if (!regionIds.has(route.homeRegionId)) {
      diagnostics.push(error(source, "route.home_region_missing", `routes.${route.id}.homeRegionId`, `${route.title} references unknown home region ${route.homeRegionId}`, "Use an existing region id."));
    }
    if (route.objectives.length !== 3) {
      diagnostics.push(warning(source, "route.objective_count", `routes.${route.id}.objectives`, `${route.title} should contain three mini-campaign objectives`, "Add or remove objectives until exactly three remain."));
    }
  }

  const pack: BrowserContentPack = {
    schemaVersion: 1,
    id: String(value.id),
    version: String(value.version),
    priority,
    routes,
    regions,
    encounters,
    dialogues,
  };
  return {
    valid: diagnostics.every(item => item.severity !== "error"),
    diagnostics,
    pack,
  };
}

export function mergeExternalContentPacks(
  base: BrowserContentPack,
  overrides: readonly BrowserContentPack[],
): ExternalContentMergeResult {
  const diagnostics: ExternalContentDiagnostic[] = [];
  const ordered = [...overrides].sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id));
  const routeMap = new Map(base.routes.map(item => [item.id, item]));
  const regionMap = new Map(base.regions.map(item => [item.id, item]));
  const encounterMap = new Map(base.encounters.map(item => [item.id, item]));
  let dialogues: Record<string, readonly string[]> = { ...base.dialogues };

  for (const pack of ordered) {
    mergeMap(routeMap, pack.routes, "routes", pack.id, diagnostics);
    mergeMap(regionMap, pack.regions, "regions", pack.id, diagnostics);
    mergeMap(encounterMap, pack.encounters, "encounters", pack.id, diagnostics);
    dialogues = { ...dialogues, ...pack.dialogues };
  }

  const merged: BrowserContentPack = {
    schemaVersion: 1,
    id: base.id,
    version: ordered.at(-1)?.version ?? base.version,
    priority: 0,
    routes: [...routeMap.values()].sort(byId),
    regions: [...regionMap.values()].sort(byId),
    encounters: [...encounterMap.values()].sort(byId),
    dialogues,
  };
  const validation = validateExternalContentPack(merged, "merged-content");
  return { pack: validation.pack ?? merged, diagnostics: [...diagnostics, ...validation.diagnostics] };
}

export function isRuntimeRegionId(value: string): value is RegionId {
  return [
    "tohsaka-residence",
    "emiya-residence",
    "school",
    "shopping-street",
    "fuyuki-bridge",
    "harbor",
    "church",
    "ryudou-temple",
  ].includes(value);
}

export function isRuntimeEncounterId(value: string): value is EncounterId {
  return ["school-night", "bridge-duel", "harbor-clash", "ryudou-siege"].includes(value);
}

function parseRoutes(values: readonly unknown[], source: string, diagnostics: ExternalContentDiagnostic[]): ExternalRouteContent[] {
  const result: ExternalRouteContent[] = [];
  values.forEach((value, index) => {
    const path = `routes[${index}]`;
    if (!isRecord(value) || !isNonEmptyString(value.id) || !isNonEmptyString(value.title) || !isNonEmptyString(value.description) || !isNonEmptyString(value.playerFactionId) || !isNonEmptyString(value.homeRegionId) || !Array.isArray(value.objectives)) {
      diagnostics.push(error(source, "route.invalid", path, "Route is missing required text fields or objectives", "Provide id, title, description, playerFactionId, homeRegionId, and objectives."));
      return;
    }
    const objectives = value.objectives.flatMap((objective, objectiveIndex) => {
      if (!isRecord(objective) || !isNonEmptyString(objective.id) || !isNonEmptyString(objective.label) || !isNonEmptyString(objective.description)) {
        diagnostics.push(error(source, "route.objective_invalid", `${path}.objectives[${objectiveIndex}]`, "Objective is incomplete", "Provide id, label, and description."));
        return [];
      }
      return [{ id: objective.id, label: objective.label, description: objective.description }];
    });
    result.push({
      id: value.id,
      title: value.title,
      description: value.description,
      playerFactionId: value.playerFactionId,
      homeRegionId: value.homeRegionId,
      objectives,
    });
  });
  return result;
}

function parseRegions(values: readonly unknown[], source: string, diagnostics: ExternalContentDiagnostic[]): ExternalRegionContent[] {
  const result: ExternalRegionContent[] = [];
  values.forEach((value, index) => {
    const path = `regions[${index}]`;
    if (!isRecord(value) || !isNonEmptyString(value.id) || !isNonEmptyString(value.name) || !isFiniteNumber(value.x) || !isFiniteNumber(value.y) || !Array.isArray(value.connections) || !isFiniteNumber(value.leylineStrength)) {
      diagnostics.push(error(source, "region.invalid", path, "Region is missing id, name, coordinates, connections, or leylineStrength", "Provide all required region fields."));
      return;
    }
    const connections = value.connections.filter(isNonEmptyString);
    if (connections.length !== value.connections.length) {
      diagnostics.push(error(source, "region.connection_invalid", `${path}.connections`, "All connections must be region id strings", "Remove invalid connection values."));
    }
    const encounterId = isNonEmptyString(value.encounterId) ? value.encounterId : undefined;
    result.push({
      id: value.id,
      name: value.name,
      x: value.x,
      y: value.y,
      connections,
      leylineStrength: Math.max(0, value.leylineStrength),
      ...(encounterId ? { encounterId } : {}),
    });
  });
  return result;
}

function parseEncounters(values: readonly unknown[], source: string, diagnostics: ExternalContentDiagnostic[]): ExternalEncounterContent[] {
  const result: ExternalEncounterContent[] = [];
  values.forEach((value, index) => {
    const path = `encounters[${index}]`;
    if (!isRecord(value) || !isNonEmptyString(value.id) || !isNonEmptyString(value.title) || !isNonEmptyString(value.subtitle) || !isNonEmptyString(value.objective) || !isNonEmptyString(value.regionId) || !isHex(value.playerStart) || !isHex(value.enemyStart)) {
      diagnostics.push(error(source, "encounter.invalid", path, "Encounter is missing required metadata or spawn coordinates", "Provide id, title, subtitle, objective, regionId, playerStart, and enemyStart."));
      return;
    }
    result.push({
      id: value.id,
      title: value.title,
      subtitle: value.subtitle,
      objective: value.objective,
      regionId: value.regionId,
      playerStart: value.playerStart,
      enemyStart: value.enemyStart,
    });
  });
  return result;
}

function parseDialogues(value: unknown, source: string, diagnostics: ExternalContentDiagnostic[]): Readonly<Record<string, readonly string[]>> {
  if (value === undefined) return {};
  if (!isRecord(value)) {
    diagnostics.push(error(source, "dialogues.invalid", "dialogues", "dialogues must be an object of string arrays", "Use an object such as { opening: [\"Line\"] }."));
    return {};
  }
  const result: Record<string, readonly string[]> = {};
  for (const [key, lines] of Object.entries(value)) {
    if (!Array.isArray(lines) || lines.some(line => typeof line !== "string")) {
      diagnostics.push(error(source, "dialogue.lines_invalid", `dialogues.${key}`, "Dialogue entries must be string arrays", "Replace every dialogue line with text."));
      continue;
    }
    result[key] = lines;
  }
  return result;
}

function validateUniqueIds(values: readonly { readonly id: string }[], path: string, source: string, diagnostics: ExternalContentDiagnostic[]): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value.id)) diagnostics.push(error(source, "content.duplicate_id", `${path}.${value.id}`, `Duplicate id ${value.id}`, "Keep only one definition or move the replacement into an override pack."));
    seen.add(value.id);
  }
}

function mergeMap<T extends { readonly id: string }>(
  target: Map<string, T>,
  values: readonly T[],
  category: string,
  source: string,
  diagnostics: ExternalContentDiagnostic[],
): void {
  for (const value of values) {
    if (target.has(value.id)) diagnostics.push(warning(source, "content.override", `${category}.${value.id}`, `${source} overrides ${category}.${value.id}`, "Confirm the override pack priority and intended replacement."));
    target.set(value.id, value);
  }
}

function invalid(source: string, code: string, path: string, message: string, suggestedFix: string): ExternalContentValidationResult {
  return { valid: false, diagnostics: [error(source, code, path, message, suggestedFix)] };
}

function error(source: string, code: string, path: string, message: string, suggestedFix: string): ExternalContentDiagnostic {
  return { source, severity: "error", code, path, message, suggestedFix };
}

function warning(source: string, code: string, path: string, message: string, suggestedFix: string): ExternalContentDiagnostic {
  return { source, severity: "warning", code, path, message, suggestedFix };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isHex(value: unknown): value is { readonly q: number; readonly r: number } {
  return isRecord(value) && isFiniteNumber(value.q) && isFiniteNumber(value.r);
}

function byId<T extends { readonly id: string }>(left: T, right: T): number {
  return left.id.localeCompare(right.id);
}
