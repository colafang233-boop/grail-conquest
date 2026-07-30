import type { FactionId } from "./ids";
import type { CampaignResult, CampaignRouteId } from "./state";

interface CampaignEventBase {
  readonly sequence: number;
}

export interface CampaignStartedEvent extends CampaignEventBase {
  readonly type: "campaign.started";
  readonly routeId: CampaignRouteId;
  readonly playerFactionId: FactionId;
}

export interface CampaignObjectiveCompletedEvent extends CampaignEventBase {
  readonly type: "campaign.objective_completed";
  readonly objectiveId: string;
}

export interface CampaignNightAdvancedEvent extends CampaignEventBase {
  readonly type: "campaign.night_advanced";
  readonly night: number;
}

export interface CampaignConsequenceAddedEvent extends CampaignEventBase {
  readonly type: "campaign.consequence_added";
  readonly consequence: string;
}

export interface CampaignCompletedEvent extends CampaignEventBase {
  readonly type: "campaign.completed";
  readonly result: CampaignResult;
}

export type CampaignDomainEvent =
  | CampaignStartedEvent
  | CampaignObjectiveCompletedEvent
  | CampaignNightAdvancedEvent
  | CampaignConsequenceAddedEvent
  | CampaignCompletedEvent;
