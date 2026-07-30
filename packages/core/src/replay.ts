import { applyAllEvent } from "./apply-all-event";
import type { AllDomainEvent } from "./all-events";
import type { EncounterId, GameState } from "./state";

export interface ReplayMetadata {
  readonly title: string;
  readonly createdAt: string;
  readonly playerFactionId?: string | undefined;
  readonly routeId?: string | undefined;
  readonly encounterId?: EncounterId | undefined;
}

export interface ReplayDocument {
  readonly formatVersion: 1;
  readonly gameSchemaVersion: 5;
  readonly metadata: ReplayMetadata;
  readonly initialState: GameState;
  readonly events: readonly AllDomainEvent[];
  readonly finalState: GameState;
  readonly finalFingerprint: string;
}

export interface ReplayValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export function createReplayDocument(input: {
  readonly title: string;
  readonly createdAt: string;
  readonly initialState: GameState;
  readonly events: readonly AllDomainEvent[];
  readonly finalState: GameState;
}): ReplayDocument {
  return {
    formatVersion: 1,
    gameSchemaVersion: 5,
    metadata: {
      title: input.title,
      createdAt: input.createdAt,
      playerFactionId: input.finalState.campaign.selectedPlayerFactionId,
      routeId: input.finalState.campaign.routeId,
      encounterId: input.finalState.strategy.activeEncounterId,
    },
    initialState: input.initialState,
    events: [...input.events],
    finalState: input.finalState,
    finalFingerprint: fingerprintGameState(input.finalState),
  };
}

export function replayToStep(document: ReplayDocument, step: number): GameState {
  const bounded = Math.max(0, Math.min(document.events.length, Math.floor(step)));
  return document.events.slice(0, bounded).reduce(applyAllEvent, document.initialState);
}

export function validateReplayDocument(value: unknown): ReplayValidationResult {
  const errors: string[] = [];
  if (!value || typeof value !== "object") return { valid: false, errors: ["Replay must be an object"] };
  const candidate = value as Partial<ReplayDocument>;
  if (candidate.formatVersion !== 1) errors.push("Unsupported replay formatVersion");
  if (candidate.gameSchemaVersion !== 5) errors.push("Replay was created for an incompatible game schema");
  if (!candidate.metadata || typeof candidate.metadata.title !== "string") errors.push("Replay metadata is missing a title");
  if (!candidate.initialState || candidate.initialState.schemaVersion !== 5) errors.push("Replay initial state is invalid");
  if (!candidate.finalState || candidate.finalState.schemaVersion !== 5) errors.push("Replay final state is invalid");
  if (!Array.isArray(candidate.events)) errors.push("Replay events must be an array");
  if (typeof candidate.finalFingerprint !== "string") errors.push("Replay final fingerprint is missing");

  if (errors.length === 0) {
    const replayed = replayToStep(candidate as ReplayDocument, candidate.events?.length ?? 0);
    const replayedFingerprint = fingerprintGameState(replayed);
    if (replayedFingerprint !== candidate.finalFingerprint) {
      errors.push("Replay events do not reproduce the declared final state");
    }
  }
  return { valid: errors.length === 0, errors };
}

export function parseReplayDocument(serialized: string): ReplayDocument {
  const parsed: unknown = JSON.parse(serialized);
  const validation = validateReplayDocument(parsed);
  if (!validation.valid) throw new Error(validation.errors.join("\n"));
  return parsed as ReplayDocument;
}

export function serializeReplayDocument(document: ReplayDocument): string {
  return JSON.stringify(document, null, 2);
}

export function fingerprintGameState(state: GameState): string {
  const serialized = JSON.stringify(state);
  let hash = 0x811c9dc5;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
