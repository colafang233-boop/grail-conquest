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
  if (state.campaign.status === "active") {
    return failure("campaign_already_active", "Finish the current campaign before starting another route");
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

function failure(code: DomainError["code"], message: string): CampaignCommandResult {
  return { ok: false, error: { code, message } };
}
