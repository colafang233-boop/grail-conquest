import {
  processCommand,
  type AllDomainEvent,
  type AllGameCommand,
  type DomainError,
  type GameState,
} from "@grail/core";

export interface GameEngineSnapshot {
  readonly version: number;
  readonly initialState: GameState;
  readonly state: GameState;
  readonly lastEvents: readonly AllDomainEvent[];
  readonly eventLog: readonly AllDomainEvent[];
  readonly lastError?: DomainError | undefined;
}

export interface DispatchResult {
  readonly ok: boolean;
  readonly events: readonly AllDomainEvent[];
  readonly error?: DomainError | undefined;
}

export class GameEngine {
  private initialState: GameState;
  private state: GameState;
  private version = 0;
  private eventLog: readonly AllDomainEvent[] = [];
  private snapshot: GameEngineSnapshot;
  private readonly listeners = new Set<() => void>();

  public constructor(initialState: GameState) {
    this.initialState = initialState;
    this.state = initialState;
    this.snapshot = {
      version: 0,
      initialState,
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
        initialState: this.initialState,
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
      initialState: this.initialState,
      state: this.state,
      lastEvents: result.events,
      eventLog: this.eventLog,
    };
    this.notify();

    return { ok: true, events: result.events };
  }

  public restore(
    state: GameState,
    eventLog: readonly AllDomainEvent[] = [],
    initialState: GameState = state,
  ): void {
    this.initialState = initialState;
    this.state = state;
    this.eventLog = [...eventLog];
    this.version += 1;
    this.snapshot = {
      version: this.version,
      initialState: this.initialState,
      state: this.state,
      lastEvents: [],
      eventLog: this.eventLog,
    };
    this.notify();
  }

  public reset(initialState: GameState): void {
    this.restore(initialState, [], initialState);
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}
