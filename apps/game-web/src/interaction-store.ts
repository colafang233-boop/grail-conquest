import type { AbilityId } from "@grail/core";

export type InteractionState =
  | { readonly type: "move" }
  | { readonly type: "attack" }
  | { readonly type: "ability"; readonly abilityId: AbilityId }
  | { readonly type: "noble_phantasm" };

class InteractionStore {
  private state: InteractionState = { type: "move" };
  private readonly listeners = new Set<() => void>();

  public readonly getSnapshot = (): InteractionState => this.state;

  public readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  public setMode(state: InteractionState): void {
    if (
      this.state.type === state.type &&
      (this.state.type !== "ability" || (state.type === "ability" && this.state.abilityId === state.abilityId))
    ) return;
    this.state = state;
    for (const listener of this.listeners) listener();
  }
}

export const interactionStore = new InteractionStore();
