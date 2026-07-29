import type { AllDomainEvent } from "./all-events";
import type { DomainError } from "./errors";
import type { OperationsGameCommand } from "./operations-commands";
import {
  ORDER_LABELS,
  advanceOperationSeed,
  createEncounterFromDetection,
  createEnemyOrder,
  createStrategicOrder,
  getContactRegion,
  resolveOperationDetection,
} from "./operations";
import {
  ENEMY_STRATEGY_FACTION_ID,
  STRATEGY_FACTION_ID,
  STRATEGY_MASTER_ID,
  STRATEGY_SERVANT_ID,
  getControlledLeylineRegions,
  getEncounterDefinition,
  isSafeRestRegion,
} from "./strategy";
import type {
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

export function executeOperationsCommand(
  state: GameState,
  command: OperationsGameCommand,
): OperationsCommandResult {
  if (state.mode !== "strategy") {
    return failure("operations_not_active", "Finish the active encounter before planning another night");
  }

  switch (command.type) {
    case "operations.submit_order":
      return submitOrder(state, command.orderType, command.destinationId);
    case "operations.cancel_order":
      return cancelOrder(state);
    case "operations.lock_orders":
      return lockOrders(state);
    case "operations.resolve_night":
      return resolveNight(state);
    case "operations.enter_encounter":
      return enterEncounter(state, command.queueId);
    case "operations.decline_encounter":
      return declineEncounter(state, command.queueId);
    case "operations.settle_night":
      return settleNight(state);
    default:
      return assertNever(command);
  }
}

function submitOrder(
  state: GameState,
  type: StrategicOrderType,
  destinationId?: RegionId,
): OperationsCommandResult {
  if (state.strategy.phase !== "planning") {
    return failure("operations_phase_invalid", "Orders can only be changed during planning");
  }
  const origin = state.strategy.currentRegionId;
  const destination = type === "move" ? destinationId : origin;
  if (!destination) return failure("operations_destination_required", "Choose a destination for movement");

  const validation = validateOrder(state, type, destination);
  if (validation) return failure(validation.code, validation.message);

  const order = createStrategicOrder(
    STRATEGY_FACTION_ID,
    type,
    origin,
    destination,
    state.strategy.day,
  );
  let sequence = state.sequence;
  return {
    ok: true,
    events: [
      { type: "operations.order_submitted", sequence: ++sequence, order },
      timeline(++sequence, "planning", `已选择：${ORDER_LABELS[type]}。锁定前仍可修改。`, destination),
    ],
  };
}

function cancelOrder(state: GameState): OperationsCommandResult {
  if (state.strategy.phase !== "planning") {
    return failure("operations_phase_invalid", "Locked orders cannot be cancelled");
  }
  if (!state.strategy.playerOrder) {
    return failure("operations_order_missing", "No player order has been submitted");
  }
  let sequence = state.sequence;
  return {
    ok: true,
    events: [
      { type: "operations.order_cancelled", sequence: ++sequence },
      timeline(++sequence, "planning", "本夜行动已撤销。"),
    ],
  };
}

function lockOrders(state: GameState): OperationsCommandResult {
  if (state.strategy.phase !== "planning") {
    return failure("operations_phase_invalid", "The operation is not in planning");
  }
  const playerOrder = state.strategy.playerOrder;
  if (!playerOrder) return failure("operations_order_missing", "Submit an order before locking the plan");
  const enemyOrder = createEnemyOrder(state, playerOrder);
  let sequence = state.sequence;
  return {
    ok: true,
    events: [
      { type: "operations.orders_locked", sequence: ++sequence, enemyOrder },
      { type: "operations.phase_changed", sequence: ++sequence, phase: "orders_locked" },
      timeline(++sequence, "orders_locked", "我方命令已封存。敌方行动仍处于未知状态。"),
    ],
  };
}

function resolveNight(state: GameState): OperationsCommandResult {
  if (state.strategy.phase !== "orders_locked") {
    return failure("operations_phase_invalid", "Lock both orders before resolving the night");
  }
  const playerOrder = state.strategy.playerOrder;
  const enemyOrder = state.strategy.enemyOrder;
  if (!playerOrder || !enemyOrder) {
    return failure("operations_order_missing", "Both factions require a locked order");
  }

  let sequence = state.sequence;
  const events: AllDomainEvent[] = [
    { type: "operations.phase_changed", sequence: ++sequence, phase: "movement_resolution" },
    timeline(++sequence, "movement_resolution", "双方命令同时公开并开始执行。"),
  ];

  if (playerOrder.destinationRegionId !== playerOrder.originRegionId) {
    events.push({
      type: "operations.faction_moved",
      sequence: ++sequence,
      factionId: STRATEGY_FACTION_ID,
      from: playerOrder.originRegionId,
      to: playerOrder.destinationRegionId,
    });
    const destination = state.strategy.regions[playerOrder.destinationRegionId];
    if (!destination.discovered) {
      events.push({
        type: "strategy.region_discovered",
        sequence: ++sequence,
        regionId: destination.id,
      });
    }
    events.push(timeline(
      ++sequence,
      "movement_resolution",
      `远坂阵营移动至${destination.name}。`,
      destination.id,
    ));
  }

  if (enemyOrder.destinationRegionId !== enemyOrder.originRegionId) {
    events.push({
      type: "operations.faction_moved",
      sequence: ++sequence,
      factionId: ENEMY_STRATEGY_FACTION_ID,
      from: enemyOrder.originRegionId,
      to: enemyOrder.destinationRegionId,
    });
    events.push(timeline(
      ++sequence,
      "movement_resolution",
      "未知 Lancer 阵营完成了秘密移动。",
      enemyOrder.destinationRegionId,
    ));
  } else {
    events.push(timeline(++sequence, "movement_resolution", "未知 Lancer 阵营留在原区域执行隐蔽行动。"));
  }

  appendPlayerOrderEffects(state, playerOrder, events, () => ++sequence);
  appendEnemyOrderEffects(state, enemyOrder, events, () => ++sequence);

  const contactRegion = getContactRegion(playerOrder, enemyOrder);
  if (!contactRegion) {
    events.push(
      timeline(++sequence, "encounter_resolution", "双方路线没有形成有效接触。今夜未发生遭遇。"),
      { type: "operations.phase_changed", sequence: ++sequence, phase: "night_settlement" },
    );
    return { ok: true, events };
  }

  const detection = resolveOperationDetection(state, playerOrder, enemyOrder, contactRegion);
  events.push(
    { type: "operations.phase_changed", sequence: ++sequence, phase: "encounter_resolution" },
    { type: "operations.detection_resolved", sequence: ++sequence, detection },
  );

  const encounter = createEncounterFromDetection(state, detection, playerOrder, enemyOrder);
  if (!encounter) {
    events.push(
      timeline(
        ++sequence,
        "encounter_resolution",
        "双方在同一区域擦肩而过，均未确认对方位置。",
        contactRegion,
      ),
      { type: "operations.phase_changed", sequence: ++sequence, phase: "night_settlement" },
    );
    return { ok: true, events };
  }

  events.push(
    { type: "operations.encounter_queued", sequence: ++sequence, encounter },
    timeline(
      ++sequence,
      "encounter_resolution",
      detectionMessage(detection.outcome, encounter.advantage),
      contactRegion,
    ),
  );
  return { ok: true, events };
}

function enterEncounter(state: GameState, queueId: string): OperationsCommandResult {
  if (state.strategy.phase !== "encounter_resolution") {
    return failure("operations_phase_invalid", "No encounter can be entered in the current phase");
  }
  const encounter = state.strategy.encounterQueue.find(item => item.id === queueId);
  if (!encounter) return failure("operations_encounter_missing", "The selected encounter is no longer available");
  const definition = getEncounterDefinition(encounter.encounterId);
  let sequence = state.sequence;
  const events: AllDomainEvent[] = [
    { type: "operations.encounter_removed", sequence: ++sequence, queueId },
    {
      type: "operations.encounter_entered",
      sequence: ++sequence,
      encounterId: encounter.encounterId,
      regionId: encounter.regionId,
      advantage: encounter.advantage,
    },
    {
      type: "scenario.encounter_started",
      sequence: ++sequence,
      scenarioId: "school-night",
    },
    timeline(++sequence, "encounter_resolution", `进入遭遇：${definition.title}。`, encounter.regionId),
  ];

  if (state.strategy.workshopPrepared) {
    events.push({
      type: "ability.barrier_applied",
      sequence: ++sequence,
      battleId: state.battle.id,
      sourceId: STRATEGY_SERVANT_ID,
      targetId: STRATEGY_SERVANT_ID,
      amount: 15,
    });
  }
  return { ok: true, events };
}

function declineEncounter(state: GameState, queueId: string): OperationsCommandResult {
  if (state.strategy.phase !== "encounter_resolution") {
    return failure("operations_phase_invalid", "No encounter can be declined in the current phase");
  }
  const encounter = state.strategy.encounterQueue.find(item => item.id === queueId);
  if (!encounter) return failure("operations_encounter_missing", "The selected encounter is no longer available");
  if (encounter.mandatory) {
    return failure("operations_encounter_mandatory", "The enemy has already detected you; this encounter is mandatory");
  }
  let sequence = state.sequence;
  return {
    ok: true,
    events: [
      { type: "operations.encounter_removed", sequence: ++sequence, queueId },
      timeline(++sequence, "encounter_resolution", "我方保持隐蔽，没有主动发起遭遇。", encounter.regionId),
      { type: "operations.phase_changed", sequence: ++sequence, phase: "night_settlement" },
    ],
  };
}

function settleNight(state: GameState): OperationsCommandResult {
  if (state.strategy.phase !== "night_settlement") {
    return failure("operations_phase_invalid", "Resolve or finish every encounter before dawn");
  }

  const master = state.battle.units[STRATEGY_MASTER_ID];
  const servant = state.battle.units[STRATEGY_SERVANT_ID];
  const contract = state.battle.contracts[STRATEGY_FACTION_ID];
  if (!master || !servant || !contract) {
    return failure("unit_not_found", "The active Master–Servant pair is incomplete");
  }

  let sequence = state.sequence;
  const events: AllDomainEvent[] = [
    { type: "operations.phase_changed", sequence: ++sequence, phase: "dawn" },
    timeline(++sequence, "dawn", `第 ${state.strategy.day + 1} 日清晨结算开始。`),
  ];
  const controlled = getControlledLeylineRegions(state);
  const power = controlled.reduce((sum, region) => sum + region.leylineStrength, 0);
  const masterIncome = power * 5;
  const servantIncome = power * 8;

  if (power > 0) {
    events.push({
      type: "strategy.mana_income",
      sequence: ++sequence,
      masterId: master.id,
      servantId: servant.id,
      masterAmount: masterIncome,
      servantAmount: servantIncome,
      sourceRegionIds: controlled.map(region => region.id),
    });
  }

  const servantManaBeforeUpkeep = Math.min(servant.maxMana, servant.mana + servantIncome);
  const paid = Math.min(servantManaBeforeUpkeep, contract.upkeep);
  events.push({
    type: "contract.servant_upkeep_paid",
    sequence: ++sequence,
    battleId: state.battle.id,
    factionId: contract.factionId,
    servantId: servant.id,
    amount: paid,
    required: contract.upkeep,
  });
  const manaAfterUpkeep = servantManaBeforeUpkeep - paid;
  const lowMana = manaAfterUpkeep < Math.ceil(servant.maxMana * 0.3);
  if (lowMana !== servant.lowMana) {
    events.push({
      type: "contract.low_mana_changed",
      sequence: ++sequence,
      battleId: state.battle.id,
      servantId: servant.id,
      lowMana,
    });
  }

  events.push(
    {
      type: "strategy.exposure_changed",
      sequence: ++sequence,
      exposure: Math.max(0, state.strategy.exposure - 10),
    },
    {
      type: "operations.enemy_exposure_changed",
      sequence: ++sequence,
      exposure: Math.max(0, state.strategy.enemyExposure - 6),
    },
    {
      type: "strategy.day_advanced",
      sequence: ++sequence,
      day: state.strategy.day + 1,
      actionPoints: state.strategy.maxActionPoints,
    },
    {
      type: "operations.seed_advanced",
      sequence: ++sequence,
      seed: advanceOperationSeed(state.strategy.operationSeed),
    },
    { type: "operations.orders_cleared", sequence: ++sequence },
    { type: "operations.workshop_prepared", sequence: ++sequence, prepared: false },
    { type: "operations.phase_changed", sequence: ++sequence, phase: "planning" },
  );
  return { ok: true, events };
}

function validateOrder(
  state: GameState,
  type: StrategicOrderType,
  destination: RegionId,
): DomainError | undefined {
  const current = state.strategy.regions[state.strategy.currentRegionId];
  if (type === "move") {
    if (destination === current.id) return { code: "operations_order_invalid", message: "Choose another region" };
    if (!current.connections.includes(destination)) {
      return { code: "strategy_region_not_connected", message: `${state.strategy.regions[destination].name} is not connected to ${current.name}` };
    }
  }
  if (type === "investigate" && current.investigated) {
    return { code: "strategy_region_already_investigated", message: `${current.name} has already been investigated` };
  }
  if (type === "defend_leyline" && current.leylineStrength <= 0) {
    return { code: "strategy_leyline_unavailable", message: `${current.name} has no leyline to defend` };
  }
  if (type === "rest" && !isSafeRestRegion(current.id)) {
    return { code: "strategy_rest_unavailable", message: "Rest is only safe at the residence or church" };
  }
  if (
    type === "prepare_workshop" &&
    current.id !== "tohsaka-residence" &&
    current.controlledBy !== STRATEGY_FACTION_ID
  ) {
    return { code: "operations_order_invalid", message: "A workshop requires the residence or a controlled leyline" };
  }
  return undefined;
}

function appendPlayerOrderEffects(
  state: GameState,
  order: StrategicOrder,
  events: AllDomainEvent[],
  nextSequence: () => number,
): void {
  const region = state.strategy.regions[order.destinationRegionId];
  switch (order.type) {
    case "move":
      events.push({
        type: "strategy.exposure_changed",
        sequence: nextSequence(),
        exposure: Math.min(100, state.strategy.exposure + 5),
      });
      break;
    case "investigate":
      if (!region.investigated) {
        events.push({ type: "strategy.region_investigated", sequence: nextSequence(), regionId: region.id });
      }
      events.push({
        type: "strategy.exposure_changed",
        sequence: nextSequence(),
        exposure: Math.min(100, state.strategy.exposure + 8),
      });
      break;
    case "defend_leyline":
      if (region.controlledBy !== STRATEGY_FACTION_ID) {
        events.push({
          type: "strategy.leyline_controlled",
          sequence: nextSequence(),
          regionId: region.id,
          factionId: STRATEGY_FACTION_ID,
        });
      }
      events.push({
        type: "strategy.exposure_changed",
        sequence: nextSequence(),
        exposure: Math.min(100, state.strategy.exposure + 6),
      });
      break;
    case "ambush":
      events.push({
        type: "strategy.exposure_changed",
        sequence: nextSequence(),
        exposure: Math.min(100, state.strategy.exposure + 4),
      });
      break;
    case "rest":
      events.push(
        {
          type: "strategy.rested",
          sequence: nextSequence(),
          masterId: STRATEGY_MASTER_ID,
          servantId: STRATEGY_SERVANT_ID,
          healthRestored: 12,
          masterManaRestored: 20,
          servantManaRestored: 15,
        },
        {
          type: "strategy.exposure_changed",
          sequence: nextSequence(),
          exposure: Math.max(0, state.strategy.exposure - 8),
        },
      );
      break;
    case "prepare_workshop":
      events.push(
        { type: "operations.workshop_prepared", sequence: nextSequence(), prepared: true },
        {
          type: "strategy.exposure_changed",
          sequence: nextSequence(),
          exposure: Math.min(100, state.strategy.exposure + 3),
        },
      );
      break;
  }
}

function appendEnemyOrderEffects(
  state: GameState,
  order: StrategicOrder,
  events: AllDomainEvent[],
  nextSequence: () => number,
): void {
  const delta = order.type === "move" ? 5 : order.type === "ambush" ? 2 : 4;
  events.push({
    type: "operations.enemy_exposure_changed",
    sequence: nextSequence(),
    exposure: Math.min(100, state.strategy.enemyExposure + delta),
  });
}

function timeline(
  sequence: number,
  phase: OperationPhase,
  message: string,
  regionId?: RegionId,
): AllDomainEvent {
  const base: StrategyTimelineEntry = { id: `timeline-${sequence}`, phase, message };
  const entry = regionId ? { ...base, regionId } : base;
  return { type: "operations.timeline_added", sequence, entry };
}

function detectionMessage(
  outcome: "mutual" | "player_only" | "enemy_only" | "missed",
  advantage: "player" | "enemy" | "none",
): string {
  if (outcome === "player_only") return "我方单向发现敌人，可选择是否发动先制遭遇。";
  if (outcome === "enemy_only") return "敌方先一步确认我方位置，遭遇将以敌方伏击开始。";
  if (outcome === "mutual" && advantage === "player") return "双方互相发现，我方阵地准备取得先制优势。";
  if (outcome === "mutual" && advantage === "enemy") return "双方互相发现，但敌方伏击部署占据优势。";
  if (outcome === "mutual") return "双方同时确认彼此位置，形成正面遭遇。";
  return "双方均未确认对方位置。";
}

function failure(code: DomainError["code"], message: string): OperationsCommandResult {
  return { ok: false, error: { code, message } };
}

function assertNever(value: never): never {
  throw new Error(`Unhandled operation command: ${JSON.stringify(value)}`);
}
