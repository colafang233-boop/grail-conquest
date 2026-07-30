import { getSelectedPlayerFaction } from "./campaign";
import type { FactionId } from "./ids";
import { getPlayerFactionId } from "./operations";
import type { OperationsDomainEvent } from "./operations-events";
import { createInitialScenarioState } from "./scenario";
import {
  ENEMY_STRATEGY_FACTION_ID,
  getEncounterDefinition,
  getStrategicFaction,
} from "./strategy";
import type { BattleUnitState, GameState, StrategicFactionState } from "./state";

export function applyOperationsEvent(state: GameState, event: OperationsDomainEvent): GameState {
  const playerFactionId = getPlayerFactionId(state);
  switch (event.type) {
    case "operations.order_submitted":
      return updateFaction({
        ...state,
        sequence: event.sequence,
        strategy: { ...state.strategy, playerOrder: event.order, resolutionTimeline: [], objective: "检查行动预览，确认后锁定本夜命令。" },
      }, event.order.factionId, faction => ({ ...faction, order: event.order }));
    case "operations.order_cancelled": {
      const { playerOrder: _player, ...strategy } = state.strategy;
      return updateFaction({ ...state, sequence: event.sequence, strategy: { ...strategy, objective: "本夜尚未选择行动。" } }, playerFactionId, faction => removeOrder(faction));
    }
    case "operations.orders_locked": {
      let next: GameState = {
        ...state,
        sequence: event.sequence,
        strategy: { ...state.strategy, enemyOrder: event.enemyOrder, objective: "命令已锁定。执行同步结算后才能看到其他阵营行动。" },
      };
      for (const order of Object.values(event.orders)) next = updateFaction(next, order.factionId, faction => ({ ...faction, order }));
      return next;
    }
    case "operations.phase_changed": {
      const phase = event.phase === "encounter_resolution" && state.strategy.encounterQueue.length === 0
        ? "night_settlement"
        : event.phase;
      return { ...state, sequence: event.sequence, strategy: { ...state.strategy, phase } };
    }
    case "operations.faction_moved": {
      let next = updateFaction(state, event.factionId, faction => ({ ...faction, regionId: event.to }));
      next = { ...next, sequence: event.sequence };
      if (event.factionId === playerFactionId) next = { ...next, strategy: { ...next.strategy, currentRegionId: event.to } };
      if (event.factionId === ENEMY_STRATEGY_FACTION_ID) next = { ...next, strategy: { ...next.strategy, enemyRegionId: event.to } };
      return next;
    }
    case "operations.faction_exposure_changed": {
      let next = updateFaction(state, event.factionId, faction => ({ ...faction, exposure: event.exposure }));
      next = { ...next, sequence: event.sequence };
      if (event.factionId === playerFactionId) next = { ...next, strategy: { ...next.strategy, exposure: event.exposure } };
      if (event.factionId === ENEMY_STRATEGY_FACTION_ID) next = { ...next, strategy: { ...next.strategy, enemyExposure: event.exposure } };
      return next;
    }
    case "operations.detection_resolved":
      return applyDetection(state, event, playerFactionId);
    case "operations.encounter_queued":
      if (!event.encounter.participantFactionIds.includes(playerFactionId)) return { ...state, sequence: event.sequence };
      return { ...state, sequence: event.sequence, strategy: { ...state.strategy, encounterQueue: [...state.strategy.encounterQueue, event.encounter] } };
    case "operations.encounter_removed":
      return { ...state, sequence: event.sequence, strategy: { ...state.strategy, encounterQueue: state.strategy.encounterQueue.filter(item => item.id !== event.queueId) } };
    case "operations.encounter_entered":
      return enterEncounter(state, event, playerFactionId);
    case "operations.timeline_added":
      return { ...state, sequence: event.sequence, strategy: { ...state.strategy, resolutionTimeline: [...state.strategy.resolutionTimeline, event.entry] } };
    case "operations.workshop_prepared":
      return { ...state, sequence: event.sequence, strategy: { ...state.strategy, workshopPrepared: event.prepared } };
    case "operations.seed_advanced":
      return { ...state, sequence: event.sequence, strategy: { ...state.strategy, operationSeed: event.seed } };
    case "operations.orders_cleared":
      return clearOrders(state, event.sequence);
    case "operations.enemy_exposure_changed":
      return applyOperationsEvent(state, { type: "operations.faction_exposure_changed", sequence: event.sequence, factionId: ENEMY_STRATEGY_FACTION_ID, exposure: event.exposure });
    case "diplomacy.offer_created":
      return { ...state, sequence: event.sequence, strategy: { ...state.strategy, allianceOffers: [...state.strategy.allianceOffers, event.offer] } };
    case "diplomacy.offer_resolved":
      return { ...state, sequence: event.sequence, strategy: { ...state.strategy, allianceOffers: state.strategy.allianceOffers.filter(offer => offer.id !== event.offerId) } };
    case "diplomacy.relation_changed":
      return { ...state, sequence: event.sequence, strategy: { ...state.strategy, diplomacy: { ...state.strategy.diplomacy, [event.relation.id]: event.relation } } };
    case "diplomacy.church_bounty_issued":
      return { ...state, sequence: event.sequence, strategy: { ...state.strategy, churchBounty: event.bounty } };
    case "diplomacy.church_bounty_cleared": {
      if (state.strategy.churchBounty?.id !== event.bountyId) return { ...state, sequence: event.sequence };
      const { churchBounty: _bounty, ...strategy } = state.strategy;
      return { ...state, sequence: event.sequence, strategy };
    }
    default:
      return assertNever(event);
  }
}

function applyDetection(
  state: GameState,
  event: Extract<OperationsDomainEvent, { readonly type: "operations.detection_resolved" }>,
  playerFactionId: FactionId,
): GameState {
  let next: GameState = {
    ...state,
    sequence: event.sequence,
    strategy: {
      ...state.strategy,
      lastDetection: event.detection,
      lastDetections: [...state.strategy.lastDetections, event.detection],
    },
  };
  const detection = event.detection;
  const first = detection.firstFactionId;
  const second = detection.secondFactionId;
  if (first === playerFactionId && detection.firstDetectedSecond && second) {
    next = updateFaction(next, second, faction => ({ ...faction, knownRegionId: detection.regionId }));
    next = { ...next, strategy: { ...next.strategy, knownEnemyRegionId: detection.regionId } };
  }
  if (second === playerFactionId && detection.secondDetectedFirst && first) {
    next = updateFaction(next, first, faction => ({ ...faction, knownRegionId: detection.regionId }));
    next = { ...next, strategy: { ...next.strategy, knownEnemyRegionId: detection.regionId } };
  }
  return next;
}

function enterEncounter(
  state: GameState,
  event: Extract<OperationsDomainEvent, { readonly type: "operations.encounter_entered" }>,
  playerFactionId: FactionId,
): GameState {
  const definition = getEncounterDefinition(event.encounterId);
  const participants = event.participantFactionIds;
  const participantSet = new Set(participants.map(String));
  const units: Record<string, BattleUnitState> = {};
  const deployedByFaction = new Map<string, number>();

  for (const unit of Object.values(state.battle.units)) {
    const deployed = participantSet.has(String(unit.factionId)) && !unit.defeated;
    const index = deployedByFaction.get(String(unit.factionId)) ?? 0;
    if (deployed) deployedByFaction.set(String(unit.factionId), index + 1);
    units[unit.id] = prepareUnit(unit, deployed, encounterPosition(unit.factionId, playerFactionId, index, definition.playerStart, definition.enemyStart));
  }

  const advantagedFaction = event.advantagedFactionId;
  const firstFactionId = advantagedFaction ?? (participants.includes(playerFactionId) ? playerFactionId : participants[0]);
  const firstFaction = firstFactionId ? getStrategicFaction(state, firstFactionId) : undefined;
  const firstServantId = firstFaction?.servantUnitIds.find(id => units[id]?.deployed && !units[id]?.defeated);
  const deployedInitiative = state.battle.initiative.filter(unitId => units[unitId]?.deployed && !units[unitId]?.defeated);
  const additionalUnits = Object.values(units)
    .filter(unit => unit.deployed && !unit.defeated && !deployedInitiative.includes(unit.id))
    .map(unit => unit.id)
    .sort((left, right) => String(left).localeCompare(String(right)));
  const allDeployed = [...deployedInitiative, ...additionalUnits];
  const activeUnitId = firstServantId ?? allDeployed[0] ?? state.battle.activeUnitId;
  const initiative = [activeUnitId, ...allDeployed.filter(unitId => unitId !== activeUnitId)];

  return {
    ...state,
    sequence: event.sequence,
    mode: "battle",
    strategy: {
      ...state.strategy,
      activeEncounterId: event.encounterId,
      activeParticipantFactionIds: participants,
      currentRegionId: event.regionId,
      workshopPrepared: false,
      objective: `${definition.title}进行中。`,
    },
    scenario: { ...createInitialScenarioState(), objective: definition.objective },
    battle: {
      ...state.battle,
      round: 1,
      activeUnitId,
      initiative,
      participatingFactionIds: participants,
      units,
    },
  };
}

function encounterPosition(
  factionId: FactionId,
  playerFactionId: FactionId,
  index: number,
  playerStart: BattleUnitState["position"],
  enemyStart: BattleUnitState["position"],
): BattleUnitState["position"] {
  if (factionId === playerFactionId) return { q: Math.min(7, playerStart.q + index), r: Math.min(5, playerStart.r + index) };
  if (factionId === ENEMY_STRATEGY_FACTION_ID) return { q: Math.max(0, enemyStart.q - index), r: Math.min(5, enemyStart.r + index) };
  const factionOffset = String(factionId) === "emiya" ? 2 : 5;
  return String(factionId) === "emiya"
    ? { q: Math.min(7, factionOffset + index), r: Math.max(0, 5 - index) }
    : { q: Math.min(7, factionOffset + index), r: Math.min(5, index + 1) };
}

function prepareUnit(unit: BattleUnitState, deployed: boolean, position: BattleUnitState["position"]): BattleUnitState {
  const noblePhantasm = unit.noblePhantasm ? resetNoblePhantasm(unit.noblePhantasm) : undefined;
  const base = {
    ...unit,
    deployed,
    position,
    remainingMovement: deployed ? unit.movement : 0,
    mainActionAvailable: deployed,
    reactionAvailable: deployed,
    barrier: 0,
    guardBonus: 0,
    battleContinuationActive: false,
    deathWardActive: false,
  };
  return noblePhantasm ? { ...base, noblePhantasm } : base;
}

function resetNoblePhantasm(noble: NonNullable<BattleUnitState["noblePhantasm"]>): NonNullable<BattleUnitState["noblePhantasm"]> {
  const { targetId: _target, ...withoutTarget } = noble;
  return { ...withoutTarget, phase: noble.cooldownRemaining > 0 ? "cooldown" : "hidden", charge: 0 };
}

function clearOrders(state: GameState, sequence: number): GameState {
  const factions: Record<string, StrategicFactionState> = {};
  for (const faction of Object.values(state.strategy.factions)) factions[faction.id] = removeOrder(faction);
  const {
    playerOrder: _playerOrder,
    enemyOrder: _enemyOrder,
    lastDetection: _detection,
    activeEncounterId: _active,
    ...strategy
  } = state.strategy;
  return {
    ...state,
    sequence,
    strategy: {
      ...strategy,
      factions,
      activeParticipantFactionIds: [],
      lastDetections: [],
      encounterQueue: [],
      objective: "为今晚选择一个行动。其他阵营命令将在计划锁定后秘密生成。",
    },
  };
}

function updateFaction(
  state: GameState,
  factionId: string,
  updater: (faction: StrategicFactionState) => StrategicFactionState,
): GameState {
  const faction = state.strategy.factions[factionId];
  if (!faction) return state;
  return {
    ...state,
    strategy: {
      ...state.strategy,
      factions: { ...state.strategy.factions, [factionId]: updater(faction) },
    },
  };
}

function removeOrder(faction: StrategicFactionState): StrategicFactionState {
  const { order: _order, ...withoutOrder } = faction;
  return withoutOrder;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled operation event: ${JSON.stringify(value)}`);
}
