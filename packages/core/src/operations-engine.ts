import type { AllDomainEvent } from "./all-events";
import { getSelectedPlayerFaction } from "./campaign";
import type { DomainError } from "./errors";
import type { FactionId, UnitId } from "./ids";
import type { OperationsGameCommand } from "./operations-commands";
import {
  ORDER_LABELS,
  advanceOperationSeed,
  createAllFactionOrders,
  createContactGroups,
  createMultiPartyEncounter,
  createStrategicOrder,
  getPlayerFactionId,
  resolveFactionDetection,
} from "./operations";
import {
  ACTIVE_STRATEGY_FACTION_IDS,
  EMIYA_FACTION_ID,
  ENEMY_STRATEGY_FACTION_ID,
  RYOUDOU_FACTION_ID,
  diplomacyKey,
  getDiplomacyRelation,
  getEncounterDefinition,
  getStrategicFaction,
} from "./strategy";
import type {
  AllianceOffer,
  DiplomacyRelation,
  GameState,
  OperationPhase,
  RegionId,
  StrategicOrder,
  StrategicOrderType,
  StrategyTimelineEntry,
} from "./state";

export type OperationsCommandResult =
  | { readonly ok: true; readonly events: readonly AllDomainEvent[] }
  | { readonly ok: false; readonly error: DomainError };

export function executeOperationsCommand(state: GameState, command: OperationsGameCommand): OperationsCommandResult {
  if (state.mode !== "strategy") return failure("operations_not_active", "Finish the active encounter before planning another night");
  switch (command.type) {
    case "operations.submit_order": return submitOrder(state, command.orderType, command.destinationId);
    case "operations.cancel_order": return cancelOrder(state);
    case "operations.lock_orders": return lockOrders(state);
    case "operations.resolve_night": return resolveNight(state);
    case "operations.enter_encounter": return enterEncounter(state, command.queueId);
    case "operations.decline_encounter": return declineEncounter(state, command.queueId);
    case "operations.settle_night": return settleNight(state);
    case "diplomacy.offer": return offerAlliance(state, command.targetFactionId, command.proposedStatus, command.durationDays);
    case "diplomacy.respond": return respondAlliance(state, command.offerId, command.accept);
    case "diplomacy.break": return breakAlliance(state, command.targetFactionId);
    default: return assertNever(command);
  }
}

function submitOrder(state: GameState, type: StrategicOrderType, destinationId?: RegionId): OperationsCommandResult {
  if (state.strategy.phase !== "planning") return failure("operations_phase_invalid", "Orders can only be changed during planning");
  const playerFactionId = getPlayerFactionId(state);
  const playerFaction = getSelectedPlayerFaction(state);
  if (!playerFaction) return failure("unit_not_found", "Player faction is missing");
  const origin = playerFaction.regionId;
  const destination = type === "move" ? destinationId : origin;
  if (!destination) return failure("operations_destination_required", "Choose a destination for movement");
  const validation = validateOrder(state, playerFactionId, type, destination);
  if (validation) return failure(validation.code, validation.message);
  const order = createStrategicOrder(playerFactionId, type, origin, destination, state.strategy.day);
  let sequence = state.sequence;
  return { ok: true, events: [
    { type: "operations.order_submitted", sequence: ++sequence, order },
    timeline(++sequence, "planning", `已选择：${ORDER_LABELS[type]}。锁定前仍可修改。`, destination),
  ] };
}

function cancelOrder(state: GameState): OperationsCommandResult {
  if (state.strategy.phase !== "planning") return failure("operations_phase_invalid", "Locked orders cannot be cancelled");
  if (!state.strategy.playerOrder) return failure("operations_order_missing", "No player order has been submitted");
  let sequence = state.sequence;
  return { ok: true, events: [
    { type: "operations.order_cancelled", sequence: ++sequence },
    timeline(++sequence, "planning", "本夜行动已撤销。"),
  ] };
}

function lockOrders(state: GameState): OperationsCommandResult {
  if (state.strategy.phase !== "planning") return failure("operations_phase_invalid", "The operation is not in planning");
  const playerOrder = state.strategy.playerOrder;
  if (!playerOrder) return failure("operations_order_missing", "Submit an order before locking the plan");
  const orders = createAllFactionOrders(state, playerOrder);
  const enemyOrder = orders[ENEMY_STRATEGY_FACTION_ID] ?? Object.values(orders).find(order => order.factionId !== playerOrder.factionId);
  if (!enemyOrder) return failure("operations_order_missing", "No opposing faction chose an order");
  let sequence = state.sequence;
  return { ok: true, events: [
    { type: "operations.orders_locked", sequence: ++sequence, enemyOrder, orders },
    { type: "operations.phase_changed", sequence: ++sequence, phase: "orders_locked" },
    timeline(++sequence, "orders_locked", "我方命令已封存。其他活动阵营的行动仍处于未知状态。"),
  ] };
}

function resolveNight(state: GameState): OperationsCommandResult {
  if (state.strategy.phase !== "orders_locked") return failure("operations_phase_invalid", "Lock all orders before resolving the night");
  const orders = collectOrders(state);
  const playerFactionId = getPlayerFactionId(state);
  if (!orders[playerFactionId] || Object.keys(orders).length < 2) return failure("operations_order_missing", "Active factions require locked orders");

  let sequence = state.sequence;
  const events: AllDomainEvent[] = [
    { type: "operations.phase_changed", sequence: ++sequence, phase: "movement_resolution" },
    timeline(++sequence, "movement_resolution", "所有活动阵营命令同时公开并开始执行。"),
  ];

  for (const order of Object.values(orders).sort((a, b) => String(a.factionId).localeCompare(String(b.factionId)))) {
    const faction = getStrategicFaction(state, order.factionId);
    if (!faction) continue;
    if (order.destinationRegionId !== order.originRegionId) {
      events.push({ type: "operations.faction_moved", sequence: ++sequence, factionId: order.factionId, from: order.originRegionId, to: order.destinationRegionId });
      if (order.factionId === playerFactionId && !state.strategy.regions[order.destinationRegionId].discovered) {
        events.push({ type: "strategy.region_discovered", sequence: ++sequence, regionId: order.destinationRegionId });
      }
      events.push(timeline(++sequence, "movement_resolution", `${faction.name}移动至${state.strategy.regions[order.destinationRegionId].name}。`, order.destinationRegionId));
    } else {
      events.push(timeline(++sequence, "movement_resolution", `${faction.name}留在${state.strategy.regions[order.originRegionId].name}执行${ORDER_LABELS[order.type]}。`, order.originRegionId));
    }
    appendOrderEffects(state, playerFactionId, faction.id, order, events, () => ++sequence);
  }

  const groups = createContactGroups(orders);
  let playerEncounterCount = 0;
  for (const group of groups) {
    const detections: ReturnType<typeof resolveFactionDetection>[] = [];
    for (let left = 0; left < group.factionIds.length; left += 1) {
      for (let right = left + 1; right < group.factionIds.length; right += 1) {
        const firstId = group.factionIds[left];
        const secondId = group.factionIds[right];
        if (!firstId || !secondId) continue;
        const firstOrder = orders[firstId];
        const secondOrder = orders[secondId];
        if (!firstOrder || !secondOrder) continue;
        const detection = resolveFactionDetection(state, firstOrder, secondOrder, group.regionId);
        detections.push(detection);
        events.push({ type: "operations.detection_resolved", sequence: ++sequence, detection });
      }
    }
    const encounter = createMultiPartyEncounter(state, group, orders, detections);
    if (!encounter) {
      events.push(timeline(++sequence, "encounter_resolution", `接触发生于${state.strategy.regions[group.regionId].name}，但未形成有效敌对遭遇。`, group.regionId));
      continue;
    }
    if (!encounter.participantFactionIds.includes(playerFactionId)) {
      events.push(timeline(++sequence, "encounter_resolution", `${state.strategy.regions[group.regionId].name}发生远处阵营冲突，已抽象结算。`, group.regionId));
      continue;
    }
    playerEncounterCount += 1;
    events.push(
      { type: "operations.encounter_queued", sequence: ++sequence, encounter },
      timeline(++sequence, "encounter_resolution", `${group.factionIds.length}支阵营在${state.strategy.regions[group.regionId].name}形成接触。`, group.regionId),
    );
  }

  events.push({ type: "operations.phase_changed", sequence: ++sequence, phase: playerEncounterCount > 0 ? "encounter_resolution" : "night_settlement" });
  appendBountyIfNeeded(state, events, () => ++sequence);
  return { ok: true, events };
}

function enterEncounter(state: GameState, queueId: string): OperationsCommandResult {
  if (state.strategy.phase !== "encounter_resolution") return failure("operations_phase_invalid", "No encounter can be entered in the current phase");
  const encounter = state.strategy.encounterQueue.find(item => item.id === queueId);
  if (!encounter) return failure("operations_encounter_missing", "The selected encounter is no longer available");
  const definition = getEncounterDefinition(encounter.encounterId);
  const playerFactionId = getPlayerFactionId(state);
  const player = getSelectedPlayerFaction(state);
  const primaryServantId = player?.servantUnitIds[0];
  let sequence = state.sequence;
  const events: AllDomainEvent[] = [
    { type: "operations.encounter_removed", sequence: ++sequence, queueId },
    {
      type: "operations.encounter_entered", sequence: ++sequence,
      encounterId: encounter.encounterId, regionId: encounter.regionId,
      advantage: encounter.advantage, participantFactionIds: encounter.participantFactionIds,
      ...(encounter.advantagedFactionId ? { advantagedFactionId: encounter.advantagedFactionId } : {}),
    },
    { type: "scenario.encounter_started", sequence: ++sequence, scenarioId: "school-night" },
    timeline(++sequence, "encounter_resolution", `进入多方遭遇：${definition.title}。`, encounter.regionId),
  ];
  if (state.strategy.workshopPrepared && primaryServantId) {
    events.push({ type: "ability.barrier_applied", sequence: ++sequence, battleId: state.battle.id, sourceId: primaryServantId, targetId: primaryServantId, amount: 15 });
  }
  if (!encounter.participantFactionIds.includes(playerFactionId)) {
    return failure("operations_encounter_missing", "The selected encounter does not involve the player faction");
  }
  return { ok: true, events };
}

function declineEncounter(state: GameState, queueId: string): OperationsCommandResult {
  if (state.strategy.phase !== "encounter_resolution") return failure("operations_phase_invalid", "No encounter can be declined in the current phase");
  const encounter = state.strategy.encounterQueue.find(item => item.id === queueId);
  if (!encounter) return failure("operations_encounter_missing", "The selected encounter is no longer available");
  if (encounter.mandatory) return failure("operations_encounter_mandatory", "A hostile faction has already detected you; this encounter is mandatory");
  let sequence = state.sequence;
  const remaining = state.strategy.encounterQueue.filter(item => item.id !== queueId);
  return { ok: true, events: [
    { type: "operations.encounter_removed", sequence: ++sequence, queueId },
    timeline(++sequence, "encounter_resolution", "我方保持隐蔽，没有主动发起多方遭遇。", encounter.regionId),
    ...(remaining.length === 0 ? [{ type: "operations.phase_changed", sequence: ++sequence, phase: "night_settlement" } as const] : []),
  ] };
}

function settleNight(state: GameState): OperationsCommandResult {
  if (state.strategy.phase !== "night_settlement") return failure("operations_phase_invalid", "Resolve or finish every encounter before dawn");
  const playerFactionId = getPlayerFactionId(state);
  const player = getSelectedPlayerFaction(state);
  const primaryServantId = player?.servantUnitIds[0];
  const master = player ? state.battle.units[player.masterUnitId] : undefined;
  const servant = primaryServantId ? state.battle.units[primaryServantId] : undefined;
  const contract = state.battle.contracts[playerFactionId];
  if (!master || !servant || !contract) return failure("unit_not_found", "The active Master–Servant pair is incomplete");

  let sequence = state.sequence;
  const events: AllDomainEvent[] = [
    { type: "operations.phase_changed", sequence: ++sequence, phase: "dawn" },
    timeline(++sequence, "dawn", `第 ${state.strategy.day + 1} 日清晨结算开始。`),
  ];
  const controlled = Object.values(state.strategy.regions)
    .filter(region => region.controlledBy === playerFactionId)
    .sort((left, right) => left.id.localeCompare(right.id));
  const power = controlled.reduce((sum, region) => sum + region.leylineStrength, 0);
  const masterIncome = power * 5;
  const servantIncome = power * 8;
  if (power > 0) events.push({ type: "strategy.mana_income", sequence: ++sequence, masterId: master.id, servantId: servant.id, masterAmount: masterIncome, servantAmount: servantIncome, sourceRegionIds: controlled.map(region => region.id) });
  const servantManaBeforeUpkeep = Math.min(servant.maxMana, servant.mana + servantIncome);
  const paid = Math.min(servantManaBeforeUpkeep, contract.upkeep);
  events.push({ type: "contract.servant_upkeep_paid", sequence: ++sequence, battleId: state.battle.id, factionId: contract.factionId, servantId: servant.id, amount: paid, required: contract.upkeep });
  const manaAfterUpkeep = servantManaBeforeUpkeep - paid;
  const lowMana = manaAfterUpkeep < Math.ceil(servant.maxMana * 0.3);
  if (lowMana !== servant.lowMana) events.push({ type: "contract.low_mana_changed", sequence: ++sequence, battleId: state.battle.id, servantId: servant.id, lowMana });

  for (const factionId of ACTIVE_STRATEGY_FACTION_IDS) {
    const faction = getStrategicFaction(state, factionId);
    if (!faction) continue;
    events.push({ type: "operations.faction_exposure_changed", sequence: ++sequence, factionId, exposure: Math.max(0, faction.exposure - (factionId === playerFactionId ? 10 : 6)) });
  }
  for (const relation of Object.values(state.strategy.diplomacy)) {
    if (relation.expiresDay !== undefined && relation.expiresDay <= state.strategy.day + 1 && (relation.status === "allied" || relation.status === "truce")) {
      events.push({ type: "diplomacy.relation_changed", sequence: ++sequence, relation: { ...relation, status: "neutral", sharedDetection: false, expiresDay: undefined } });
    }
  }
  events.push(
    { type: "strategy.day_advanced", sequence: ++sequence, day: state.strategy.day + 1, actionPoints: state.strategy.maxActionPoints },
    { type: "operations.seed_advanced", sequence: ++sequence, seed: advanceOperationSeed(state.strategy.operationSeed) },
    { type: "operations.orders_cleared", sequence: ++sequence },
    { type: "operations.workshop_prepared", sequence: ++sequence, prepared: false },
    { type: "operations.phase_changed", sequence: ++sequence, phase: "planning" },
  );
  return { ok: true, events };
}

function offerAlliance(
  state: GameState,
  targetFactionId: FactionId,
  proposedStatus: "truce" | "allied",
  durationDays: number,
): OperationsCommandResult {
  if (state.strategy.phase !== "planning") return failure("operations_phase_invalid", "Diplomacy is only available during planning");
  const playerFactionId = getPlayerFactionId(state);
  if (targetFactionId === playerFactionId) return failure("operations_order_invalid", "Cannot negotiate with your own faction");
  const target = getStrategicFaction(state, targetFactionId);
  if (!target || target.status !== "active") return failure("unit_not_found", "The target faction is unavailable");
  const existing = getDiplomacyRelation(state, playerFactionId, targetFactionId);
  if (existing?.status === "betrayed") return failure("operations_order_invalid", "This faction refuses negotiation after betrayal");
  const offer: AllianceOffer = {
    id: `offer-${state.strategy.day}-${playerFactionId}-${targetFactionId}-${proposedStatus}`,
    fromFactionId: playerFactionId,
    toFactionId: targetFactionId,
    proposedStatus,
    durationDays: Math.max(1, durationDays),
    expiresDay: state.strategy.day + 1,
  };
  const accepted = targetFactionId !== ENEMY_STRATEGY_FACTION_ID &&
    (targetFactionId === EMIYA_FACTION_ID || playerFactionId === EMIYA_FACTION_ID || proposedStatus === "truce");
  let sequence = state.sequence;
  const events: AllDomainEvent[] = [
    { type: "diplomacy.offer_created", sequence: ++sequence, offer },
    { type: "diplomacy.offer_resolved", sequence: ++sequence, offerId: offer.id, accepted },
  ];
  if (accepted) {
    events.push({ type: "diplomacy.relation_changed", sequence: ++sequence, relation: createRelation(state, playerFactionId, targetFactionId, proposedStatus, state.strategy.day + offer.durationDays) });
    events.push(timeline(++sequence, "planning", `${target.name}接受了${proposedStatus === "allied" ? "临时联盟" : "停战"}提议。`));
  } else {
    events.push(timeline(++sequence, "planning", `${target.name}拒绝了外交提议。`));
  }
  return { ok: true, events };
}

function respondAlliance(state: GameState, offerId: string, accept: boolean): OperationsCommandResult {
  const playerFactionId = getPlayerFactionId(state);
  const offer = state.strategy.allianceOffers.find(item => item.id === offerId && item.toFactionId === playerFactionId);
  if (!offer) return failure("operations_order_missing", "Alliance offer no longer exists");
  let sequence = state.sequence;
  const events: AllDomainEvent[] = [{ type: "diplomacy.offer_resolved", sequence: ++sequence, offerId, accepted: accept }];
  if (accept) events.push({ type: "diplomacy.relation_changed", sequence: ++sequence, relation: createRelation(state, offer.fromFactionId, playerFactionId, offer.proposedStatus, state.strategy.day + offer.durationDays) });
  return { ok: true, events };
}

function breakAlliance(state: GameState, targetFactionId: FactionId): OperationsCommandResult {
  const playerFactionId = getPlayerFactionId(state);
  const current = getDiplomacyRelation(state, playerFactionId, targetFactionId);
  if (!current || (current.status !== "allied" && current.status !== "truce")) return failure("operations_order_invalid", "No active agreement exists with that faction");
  let sequence = state.sequence;
  return { ok: true, events: [
    { type: "diplomacy.relation_changed", sequence: ++sequence, relation: { ...current, status: "betrayed", sharedDetection: false, betrayalCount: current.betrayalCount + 1, expiresDay: undefined } },
    timeline(++sequence, "planning", "我方主动撕毁协议。该阵营将永久记住这次背叛。"),
  ] };
}

function createRelation(
  state: GameState,
  firstFactionId: FactionId,
  secondFactionId: FactionId,
  status: "truce" | "allied",
  expiresDay: number,
): DiplomacyRelation {
  const existing = getDiplomacyRelation(state, firstFactionId, secondFactionId);
  return {
    id: diplomacyKey(firstFactionId, secondFactionId),
    firstFactionId: existing?.firstFactionId ?? firstFactionId,
    secondFactionId: existing?.secondFactionId ?? secondFactionId,
    status,
    sharedDetection: status === "allied",
    expiresDay,
    betrayalCount: existing?.betrayalCount ?? 0,
  };
}

function collectOrders(state: GameState): Readonly<Record<string, StrategicOrder>> {
  const result: Record<string, StrategicOrder> = {};
  for (const faction of Object.values(state.strategy.factions)) if (faction.order) result[faction.id] = faction.order;
  if (state.strategy.playerOrder) result[state.strategy.playerOrder.factionId] = state.strategy.playerOrder;
  if (state.strategy.enemyOrder) result[state.strategy.enemyOrder.factionId] = state.strategy.enemyOrder;
  return result;
}

function validateOrder(
  state: GameState,
  playerFactionId: FactionId,
  type: StrategicOrderType,
  destination: RegionId,
): DomainError | undefined {
  const player = getStrategicFaction(state, playerFactionId);
  if (!player) return { code: "unit_not_found", message: "Player faction is missing" };
  const current = state.strategy.regions[player.regionId];
  if (type === "move") {
    if (destination === current.id) return { code: "operations_order_invalid", message: "Choose another region" };
    if (!current.connections.includes(destination)) return { code: "strategy_region_not_connected", message: `${state.strategy.regions[destination].name} is not connected to ${current.name}` };
  }
  if (type === "investigate" && current.investigated) return { code: "strategy_region_already_investigated", message: `${current.name} has already been investigated` };
  if (type === "defend_leyline" && current.leylineStrength <= 0) return { code: "strategy_leyline_unavailable", message: `${current.name} has no leyline to defend` };
  if (type === "rest" && !isSafePlayerRegion(current.id, player.regionId)) return { code: "strategy_rest_unavailable", message: "Rest requires a home base or the church" };
  if (type === "prepare_workshop" && current.id !== player.regionId && current.controlledBy !== playerFactionId) return { code: "operations_order_invalid", message: "A workshop requires the current home base or a controlled leyline" };
  return undefined;
}

function appendOrderEffects(
  state: GameState,
  playerFactionId: FactionId,
  factionId: FactionId,
  order: StrategicOrder,
  events: AllDomainEvent[],
  nextSequence: () => number,
): void {
  const faction = getStrategicFaction(state, factionId);
  if (!faction) return;
  let exposure = faction.exposure;
  if (order.type === "move") exposure += 5;
  if (order.type === "investigate") exposure += 8;
  if (order.type === "defend_leyline") exposure += 6;
  if (order.type === "ambush") exposure += 4;
  if (order.type === "prepare_workshop") exposure += 3;
  if (order.type === "rest") exposure -= 8;
  events.push({ type: "operations.faction_exposure_changed", sequence: nextSequence(), factionId, exposure: Math.max(0, Math.min(100, exposure)) });

  if (factionId !== playerFactionId) return;
  const region = state.strategy.regions[order.destinationRegionId];
  const player = getSelectedPlayerFaction(state);
  const primaryServantId = player?.servantUnitIds[0];
  if (order.type === "investigate" && !region.investigated) events.push({ type: "strategy.region_investigated", sequence: nextSequence(), regionId: region.id });
  if (order.type === "defend_leyline" && region.controlledBy !== playerFactionId) events.push({ type: "strategy.leyline_controlled", sequence: nextSequence(), regionId: region.id, factionId: playerFactionId });
  if (order.type === "rest" && player && primaryServantId) events.push({ type: "strategy.rested", sequence: nextSequence(), masterId: player.masterUnitId, servantId: primaryServantId, healthRestored: 12, masterManaRestored: 20, servantManaRestored: 15 });
  if (order.type === "prepare_workshop") events.push({ type: "operations.workshop_prepared", sequence: nextSequence(), prepared: true });
}

function appendBountyIfNeeded(state: GameState, events: AllDomainEvent[], nextSequence: () => number): void {
  if (state.strategy.churchBounty?.active) return;
  const target = Object.values(state.strategy.factions)
    .filter(faction => faction.status === "active" && faction.exposure >= 75)
    .sort((a, b) => b.exposure - a.exposure || String(a.id).localeCompare(String(b.id)))[0];
  if (!target) return;
  events.push({
    type: "diplomacy.church_bounty_issued",
    sequence: nextSequence(),
    bounty: {
      id: `church-bounty-${state.strategy.day}-${target.id}`,
      targetFactionId: target.id,
      issuedDay: state.strategy.day,
      reason: `${target.name}的暴露度与魔力活动已威胁圣杯战争隐秘性。`,
      intelligenceReward: 20,
      active: true,
    },
  });
}

function isSafePlayerRegion(regionId: RegionId, homeRegionId: RegionId): boolean {
  return regionId === homeRegionId || regionId === "church" || regionId === "ryudou-temple";
}

function timeline(sequence: number, phase: OperationPhase, message: string, regionId?: RegionId): AllDomainEvent {
  const base: StrategyTimelineEntry = { id: `timeline-${sequence}`, phase, message };
  return { type: "operations.timeline_added", sequence, entry: regionId ? { ...base, regionId } : base };
}

function failure(code: DomainError["code"], message: string): OperationsCommandResult {
  return { ok: false, error: { code, message } };
}

function assertNever(value: never): never {
  throw new Error(`Unhandled operation command: ${JSON.stringify(value)}`);
}
