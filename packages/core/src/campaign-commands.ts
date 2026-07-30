import type { CampaignRouteId } from "./state";

export interface StartCampaignCommand {
  readonly type: "campaign.start";
  readonly routeId: CampaignRouteId;
}

export type CampaignGameCommand = StartCampaignCommand;
