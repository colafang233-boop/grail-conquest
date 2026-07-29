export type InteractionMode = "move" | "attack";

class InteractionStore {
  private mode: InteractionMode = "move";
  private readonly listeners = new Set<() => void>();

  public readonly getSnapshot = (): InteractionMode => this.mode;

  public readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  public setMode(mode: InteractionMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    for (const listener of this.listeners) listener();
  }
}

export const interactionStore = new InteractionStore();
