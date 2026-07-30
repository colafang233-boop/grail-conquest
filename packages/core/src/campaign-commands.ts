import type { CampaignRouteId } from "./state";

export interface StartCampaignCommand {
  readonly type: "campaign.start";
  readonly routeId: CampaignRouteId;
}

export interface ReturnToCampaignSetupCommand {
  readonly type: "campaign.return_to_setup";
}

export type CampaignGameCommand = StartCampaignCommand | ReturnToCampaignSetupCommand;
