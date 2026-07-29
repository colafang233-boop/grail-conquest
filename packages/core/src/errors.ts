export type DomainErrorCode =
  | "battle_not_found"
  | "unit_not_found"
  | "target_not_found"
  | "not_active_unit"
  | "tile_not_found"
  | "same_position"
  | "destination_unreachable"
  | "initiative_invalid"
  | "attacker_defeated"
  | "target_defeated"
  | "friendly_target"
  | "attack_out_of_range"
  | "main_action_unavailable";

export interface DomainError {
  readonly code: DomainErrorCode;
  readonly message: string;
}
