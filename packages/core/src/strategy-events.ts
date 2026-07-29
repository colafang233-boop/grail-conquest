import type { FactionId, UnitId } from "./ids";
import type { EncounterId, RegionId, ScenarioOutcome, ScenarioReport } from "./state";

interface StrategyEventBase {
  readonly sequence: number;
}

export interface StrategyActionPointsSpentEvent extends StrategyEventBase {
  readonly type: "strategy.action_points_spent";
  readonly amount: number;
}

export interface StrategyRegionMovedEvent extends StrategyEventBase {
  readonly type: "strategy.region_moved";
  readonly from: RegionId;
  readonly to: RegionId;
}

export interface StrategyRegionDiscoveredEvent extends StrategyEventBase {
  readonly type: "strategy.region_discovered";
  readonly regionId: RegionId;
}

export interface StrategyRegionInvestigatedEvent extends StrategyEventBase {
  readonly type: "strategy.region_investigated";
  readonly regionId: RegionId;
}

export interface StrategyLeylineControlledEvent extends StrategyEventBase {
  readonly type: "strategy.leyline_controlled";
  readonly regionId: RegionId;
  readonly factionId: FactionId;
}

export interface StrategyExposureChangedEvent extends StrategyEventBase {
  readonly type: "strategy.exposure_changed";
  readonly exposure: number;
}

export interface StrategyRestedEvent extends StrategyEventBase {
  readonly type: "strategy.rested";
  readonly masterId: UnitId;
  readonly servantId: UnitId;
  readonly healthRestored: number;
  readonly masterManaRestored: number;
  readonly servantManaRestored: number;
}

export interface StrategyDayAdvancedEvent extends StrategyEventBase {
  readonly type: "strategy.day_advanced";
  readonly day: number;
  readonly actionPoints: number;
}

export interface StrategyManaIncomeEvent extends StrategyEventBase {
  readonly type: "strategy.mana_income";
  readonly masterId: UnitId;
  readonly servantId: UnitId;
  readonly masterAmount: number;
  readonly servantAmount: number;
  readonly sourceRegionIds: readonly RegionId[];
}

export interface StrategyEncounterPreparedEvent extends StrategyEventBase {
  readonly type: "strategy.encounter_prepared";
  readonly encounterId: EncounterId;
  readonly regionId: RegionId;
}

export interface StrategyEncounterEnteredEvent extends StrategyEventBase {
  readonly type: "strategy.encounter_entered";
  readonly encounterId: EncounterId;
}

export interface StrategyReturnedEvent extends StrategyEventBase {
  readonly type: "strategy.returned";
  readonly encounterId: EncounterId;
  readonly outcome: ScenarioOutcome;
  readonly report: ScenarioReport;
}

export type StrategyDomainEvent =
  | StrategyActionPointsSpentEvent
  | StrategyRegionMovedEvent
  | StrategyRegionDiscoveredEvent
  | StrategyRegionInvestigatedEvent
  | StrategyLeylineControlledEvent
  | StrategyExposureChangedEvent
  | StrategyRestedEvent
  | StrategyDayAdvancedEvent
  | StrategyManaIncomeEvent
  | StrategyEncounterPreparedEvent
  | StrategyEncounterEnteredEvent
  | StrategyReturnedEvent;
