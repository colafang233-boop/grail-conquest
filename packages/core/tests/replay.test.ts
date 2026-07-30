import { describe, expect, it } from "vitest";
import {
  createNewGameState,
  createReplayDocument,
  fingerprintGameState,
  processCommand,
  replayToStep,
  serializeReplayDocument,
  parseReplayDocument,
  validateReplayDocument,
  type AllDomainEvent,
  type GameState,
} from "../src";

describe("replay documents", () => {
  it("reproduces the same final state from initial state and events", () => {
    const initial = createNewGameState();
    let state: GameState = initial;
    const events: AllDomainEvent[] = [];

    const started = processCommand(state, { type: "campaign.start", routeId: "tohsaka-route" });
    if (!started.ok) throw new Error(started.error.message);
    state = started.state;
    events.push(...started.events);

    const ordered = processCommand(state, { type: "operations.submit_order", orderType: "ambush" });
    if (!ordered.ok) throw new Error(ordered.error.message);
    state = ordered.state;
    events.push(...ordered.events);

    const document = createReplayDocument({
      title: "Replay test",
      createdAt: "2026-07-30T00:00:00.000Z",
      initialState: initial,
      events,
      finalState: state,
    });

    expect(validateReplayDocument(document)).toEqual({ valid: true, errors: [] });
    const replayed = replayToStep(document, events.length);
    expect(fingerprintGameState(replayed)).toBe(fingerprintGameState(state));
    expect(replayed).toEqual(state);

    const parsed = parseReplayDocument(serializeReplayDocument(document));
    expect(parsed.finalFingerprint).toBe(document.finalFingerprint);
  });

  it("rejects a replay whose events do not match the declared final state", () => {
    const initial = createNewGameState();
    const document = createReplayDocument({
      title: "Corrupt replay",
      createdAt: "2026-07-30T00:00:00.000Z",
      initialState: initial,
      events: [],
      finalState: initial,
    });
    const corrupted = {
      ...document,
      finalFingerprint: "00000000",
    };
    const result = validateReplayDocument(corrupted);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Replay events do not reproduce the declared final state");
  });
});
