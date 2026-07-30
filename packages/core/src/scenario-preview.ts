import { getPlayerFactionId } from "./operations";
import { ENEMY_STRATEGY_FACTION_ID, getStrategicFaction } from "./strategy";
import type { BrowserContentPack, ExternalEncounterContent } from "./external-content";
import { isRuntimeEncounterId, isRuntimeRegionId } from "./external-content";
import type { BattleUnitState, EncounterId, GameState, RegionId, StrategyRegionState } from "./state";

export interface ScenarioPreviewResult {
  readonly state?: GameState;
  readonly error?: string;
}

export function createScenarioPreviewState(
  baseState: GameState,
  pack: BrowserContentPack,
  encounterId: string,
): ScenarioPreviewResult {
  if (!isRuntimeEncounterId(encounterId)) {
    return { error: `Encounter ${encounterId} is not supported by the current browser runtime` };
  }
  const encounter = pack.encounters.find(item => item.id === encounterId);
  if (!encounter) return { error: `Encounter ${encounterId} was not found in the active content pack` };
  if (!isRuntimeRegionId(encounter.regionId)) {
    return { error: `Encounter ${encounterId} references unsupported region ${encounter.regionId}` };
  }

  const regions = applyRegionOverrides(baseState, pack);
  const playerFactionId = getPlayerFactionId(baseState);
  const player = getStrategicFaction(baseState, playerFactionId);
  const opponent = getStrategicFaction(baseState, ENEMY_STRATEGY_FACTION_ID);
  if (!player || !opponent) return { error: "Preview requires an active player faction and Lancer opponent" };

  const participantIds = [playerFactionId, ENEMY_STRATEGY_FACTION_ID] as const;
  const deployedUnits: Record<string, BattleUnitState> = {};
  let playerOffset = 0;
  let enemyOffset = 0;
  for (const unit of Object.values(baseState.battle.units)) {
    const isPlayer = unit.factionId === playerFactionId;
    const isEnemy = unit.factionId === ENEMY_STRATEGY_FACTION_ID;
    const deployed = (isPlayer || isEnemy) && !unit.defeated;
    const offset = isPlayer ? playerOffset++ : isEnemy ? enemyOffset++ : 0;
    const start = isPlayer ? encounter.playerStart : encounter.enemyStart;
    deployedUnits[unit.id] = resetUnit(unit, deployed, {
      q: clamp(start.q + (isPlayer ? offset : -offset), 0, 7),
      r: clamp(start.r + offset, 0, 5),
    });
  }

  const playerServantId = player.servantUnitIds.find(id => deployedUnits[id]?.deployed);
  const initiative = [
    ...(playerServantId ? [playerServantId] : []),
    ...baseState.battle.initiative.filter(id => deployedUnits[id]?.deployed && id !== playerServantId),
    ...Object.values(deployedUnits)
      .filter(unit => unit.deployed && unit.id !== playerServantId && !baseState.battle.initiative.includes(unit.id))
      .map(unit => unit.id)
      .sort((left, right) => String(left).localeCompare(String(right))),
  ];
  const activeUnitId = initiative[0] ?? baseState.battle.activeUnitId;

  return {
    state: {
      ...baseState,
      mode: "battle",
      sequence: 0,
      strategy: {
        ...baseState.strategy,
        regions,
        currentRegionId: encounter.regionId,
        activeEncounterId: encounterId as EncounterId,
        activeParticipantFactionIds: participantIds,
        encounterQueue: [],
        phase: "encounter_resolution",
        objective: `场景编辑器测试：${encounter.title}`,
      },
      scenario: {
        ...baseState.scenario,
        phase: "encounter",
        objective: encounter.objective,
        clues: [],
      },
      battle: {
        ...baseState.battle,
        round: 1,
        activeUnitId,
        initiative,
        participatingFactionIds: participantIds,
        units: deployedUnits,
      },
    },
  };
}

function applyRegionOverrides(
  state: GameState,
  pack: BrowserContentPack,
): Readonly<Record<RegionId, StrategyRegionState>> {
  const regions: Record<RegionId, StrategyRegionState> = { ...state.strategy.regions };
  for (const content of pack.regions) {
    if (!isRuntimeRegionId(content.id)) continue;
    const existing = regions[content.id];
    const connections = content.connections.filter(isRuntimeRegionId);
    const encounterId = content.encounterId && isRuntimeEncounterId(content.encounterId)
      ? content.encounterId
      : undefined;
    regions[content.id] = {
      ...existing,
      name: content.name,
      x: content.x,
      y: content.y,
      connections,
      leylineStrength: Math.max(0, content.leylineStrength),
      ...(encounterId ? { encounterId } : removeEncounter(existing)),
    };
  }
  return regions;
}

function removeEncounter(region: StrategyRegionState): Pick<StrategyRegionState, never> {
  const { encounterId: _encounterId, ...withoutEncounter } = region;
  void withoutEncounter;
  return {};
}

function resetUnit(
  unit: BattleUnitState,
  deployed: boolean,
  position: BattleUnitState["position"],
): BattleUnitState {
  const noblePhantasm = unit.noblePhantasm
    ? {
        ...unit.noblePhantasm,
        phase: unit.noblePhantasm.cooldownRemaining > 0 ? "cooldown" as const : "hidden" as const,
        charge: 0,
        targetId: undefined,
      }
    : undefined;
  return {
    ...unit,
    deployed,
    position,
    remainingMovement: deployed ? unit.movement : 0,
    mainActionAvailable: deployed,
    reactionAvailable: deployed,
    barrier: 0,
    guardBonus: 0,
    deathWardActive: false,
    battleContinuationActive: false,
    ...(noblePhantasm ? { noblePhantasm } : {}),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.trunc(value)));
}
