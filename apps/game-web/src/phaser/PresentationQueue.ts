import type { DomainEvent } from "@grail/core";

export type EventPresenter = (event: DomainEvent) => Promise<void>;

export class PresentationQueue {
  private readonly queue: DomainEvent[] = [];
  private playing = false;

  public constructor(private readonly present: EventPresenter) {}

  public enqueue(events: readonly DomainEvent[]): void {
    this.queue.push(...events);
    if (!this.playing) void this.play();
  }

  private async play(): Promise<void> {
    this.playing = true;

    try {
      while (this.queue.length > 0) {
        const event = this.queue.shift();
        if (event) await this.present(event);
      }
    } finally {
      this.playing = false;
    }
  }
}
