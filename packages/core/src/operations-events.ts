import type { FactionId } from "./ids";
import type {
  EncounterId,
  OperationDetection,
  OperationPhase,
  RegionId,
  StrategicOrder,
  StrategyEncounterQueueItem,
  StrategyTimelineEntry,
} from "./state";

interface OperationEventBase {
  readonly sequence: number;
}

export interface OperationOrderSubmittedEvent extends OperationEventBase {
  readonly type: "operations.order_submitted";
  readonly order: StrategicOrder;
}

export interface OperationOrderCancelledEvent extends OperationEventBase {
  readonly type: "operations.order_cancelled";
}

export interface OperationOrdersLockedEvent extends OperationEventBase {
  readonly type: "operations.orders_locked";
  readonly enemyOrder: StrategicOrder;
}

export interface OperationPhaseChangedEvent extends OperationEventBase {
  readonly type: "operations.phase_changed";
  readonly phase: OperationPhase;
}

export interface OperationFactionMovedEvent extends OperationEventBase {
  readonly type: "operations.faction_moved";
  readonly factionId: FactionId;
  readonly from: RegionId;
  readonly to: RegionId;
}

export interface OperationDetectionResolvedEvent extends OperationEventBase {
  readonly type: "operations.detection_resolved";
  readonly detection: OperationDetection;
}

export interface OperationEncounterQueuedEvent extends OperationEventBase {
  readonly type: "operations.encounter_queued";
  readonly encounter: StrategyEncounterQueueItem;
}

export interface OperationEncounterRemovedEvent extends OperationEventBase {
  readonly type: "operations.encounter_removed";
  readonly queueId: string;
}

export interface OperationEncounterEnteredEvent extends OperationEventBase {
  readonly type: "operations.encounter_entered";
  readonly encounterId: EncounterId;
  readonly regionId: RegionId;
  readonly advantage: StrategyEncounterQueueItem["advantage"];
}

export interface OperationTimelineAddedEvent extends OperationEventBase {
  readonly type: "operations.timeline_added";
  readonly entry: StrategyTimelineEntry;
}

export interface OperationWorkshopPreparedEvent extends OperationEventBase {
  readonly type: "operations.workshop_prepared";
  readonly prepared: boolean;
}

export interface OperationSeedAdvancedEvent extends OperationEventBase {
  readonly type: "operations.seed_advanced";
  readonly seed: number;
}

export interface OperationOrdersClearedEvent extends OperationEventBase {
  readonly type: "operations.orders_cleared";
}

export interface OperationEnemyExposureChangedEvent extends OperationEventBase {
  readonly type: "operations.enemy_exposure_changed";
  readonly exposure: number;
}

export type OperationsDomainEvent =
  | OperationOrderSubmittedEvent
  | OperationOrderCancelledEvent
  | OperationOrdersLockedEvent
  | OperationPhaseChangedEvent
  | OperationFactionMovedEvent
  | OperationDetectionResolvedEvent
  | OperationEncounterQueuedEvent
  | OperationEncounterRemovedEvent
  | OperationEncounterEnteredEvent
  | OperationTimelineAddedEvent
  | OperationWorkshopPreparedEvent
  | OperationSeedAdvancedEvent
  | OperationOrdersClearedEvent
  | OperationEnemyExposureChangedEvent;
