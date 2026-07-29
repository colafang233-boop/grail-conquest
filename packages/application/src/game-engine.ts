import {
  processCommand,
  type AllGameCommand,
  type DomainError,
  type DomainEvent,
  type GameState,
} from "@grail/core";

export interface GameEngineSnapshot {
  readonly version: number;
  readonly state: GameState;
  readonly lastEvents: readonly DomainEvent[];
  readonly eventLog: readonly DomainEvent[];
  readonly lastError?: DomainError;
}

export interface DispatchResult {
  readonly ok: boolean;
  readonly events: readonly DomainEvent[];
  readonly error?: DomainError;
}

export class GameEngine {
  private state: GameState;
  private version = 0;
  private eventLog: readonly DomainEvent[] = [];
  private snapshot: GameEngineSnapshot;
  private readonly listeners = new Set<() => void>();

  public constructor(initialState: GameState) {
    this.state = initialState;
    this.snapshot = {
      version: 0,
      state: initialState,
      lastEvents: [],
      eventLog: [],
    };
  }

  public readonly getSnapshot = (): GameEngineSnapshot => this.snapshot;

  public readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  public dispatch(command: AllGameCommand): DispatchResult {
    const result = processCommand(this.state, command);

    if (!result.ok) {
      this.snapshot = {
        version: this.version,
        state: this.state,
        lastEvents: [],
        eventLog: this.eventLog,
        lastError: result.error,
      };
      this.notify();
      return { ok: false, events: [], error: result.error };
    }

    this.state = result.state;
    this.version += 1;
    this.eventLog = [...this.eventLog, ...result.events];
    this.snapshot = {
      version: this.version,
      state: this.state,
      lastEvents: result.events,
      eventLog: this.eventLog,
    };
    this.notify();

    return { ok: true, events: result.events };
  }

  public restore(state: GameState, eventLog: readonly DomainEvent[] = []): void {
    this.state = state;
    this.eventLog = [...eventLog];
    this.version += 1;
    this.snapshot = {
      version: this.version,
      state: this.state,
      lastEvents: [],
      eventLog: this.eventLog,
    };
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}
