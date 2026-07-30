import { getCampaignRoute } from "./campaign";
import type { CampaignGameCommand } from "./campaign-commands";
import type { CampaignDomainEvent } from "./campaign-events";
import type { DomainError } from "./errors";
import type { GameState } from "./state";

export type CampaignCommandResult =
  | { readonly ok: true; readonly events: readonly CampaignDomainEvent[] }
  | { readonly ok: false; readonly error: DomainError };

export function executeCampaignCommand(
  state: GameState,
  command: CampaignGameCommand,
): CampaignCommandResult {
  switch (command.type) {
    case "campaign.start": {
      if (state.campaign.status === "active") {
        return failure("campaign_already_active", "Finish or reset the current campaign first");
      }
      const route = getCampaignRoute(command.routeId);
      if (!route) return failure("campaign_route_invalid", `Unknown campaign route ${command.routeId}`);
      return {
        ok: true,
        events: [{
          type: "campaign.started",
          sequence: state.sequence + 1,
          routeId: route.id,
          playerFactionId: route.playerFactionId,
        }],
      };
    }
    case "campaign.return_to_setup":
      if (state.campaign.status !== "completed") {
        return failure("campaign_not_completed", "Only a completed campaign can return to route selection");
      }
      return {
        ok: true,
        events: [{
          type: "campaign.started",
          sequence: state.sequence + 1,
          routeId: "tohsaka-route",
          playerFactionId: state.campaign.selectedPlayerFactionId ?? getCampaignRoute("tohsaka-route").playerFactionId,
        }],
      };
  }
}

function failure(code: DomainError["code"], message: string): CampaignCommandResult {
  return { ok: false, error: { code, message } };
}
