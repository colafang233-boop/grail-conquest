export type DomainErrorCode =
  | "battle_not_found"
  | "unit_not_found"
  | "not_active_unit"
  | "tile_not_found"
  | "same_position"
  | "destination_unreachable"
  | "initiative_invalid";

export interface DomainError {
  readonly code: DomainErrorCode;
  readonly message: string;
}
