import Phaser from "phaser";
import { STRATEGY_FACTION_ID, type RegionId, type StrategyRegionState } from "@grail/core";
import { gameEngine } from "../game-engine";

interface RegionView {
  readonly container: Phaser.GameObjects.Container;
  readonly marker: Phaser.GameObjects.Arc;
  readonly label: Phaser.GameObjects.Text;
  readonly status: Phaser.GameObjects.Text;
}

export class StrategyMapScene extends Phaser.Scene {
  private readonly regionViews = new Map<RegionId, RegionView>();
  private readonly links: Phaser.GameObjects.Line[] = [];
  private unsubscribe?: () => void;

  public constructor() {
    super("fuyuki-strategy");
  }

  public create(): void {
    this.cameras.main.setBackgroundColor("#080d15");
    this.drawMap();
    this.refresh();
    this.unsubscribe = gameEngine.subscribe(() => this.refresh());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubscribe?.());
  }

  private drawMap(): void {
    const regions = gameEngine.getSnapshot().state.strategy.regions;
    const drawn = new Set<string>();

    for (const region of Object.values(regions)) {
      for (const targetId of region.connections) {
        const key = [region.id, targetId].sort().join(":");
        if (drawn.has(key)) continue;
        drawn.add(key);
        const target = regions[targetId];
        const line = this.add.line(0, 0, region.x, region.y, target.x, target.y, 0x516176, 0.55)
          .setOrigin(0)
          .setLineWidth(3, 3);
        line.setData("from", region.id);
        line.setData("to", target.id);
        this.links.push(line);
      }
    }

    for (const region of Object.values(regions)) this.drawRegion(region);
  }

  private drawRegion(region: StrategyRegionState): void {
    const container = this.add.container(region.x, region.y);
    const halo = this.add.circle(0, 0, 31, 0x0b1019, 0.9).setStrokeStyle(1, 0x38465a, 0.9);
    const marker = this.add.circle(0, 0, 21, 0x273548, 1).setStrokeStyle(3, 0x7d8da2, 1);
    marker.setInteractive({ useHandCursor: true });
    marker.on(Phaser.Input.Events.POINTER_DOWN, () => this.planMove(region.id));

    const label = this.add.text(0, 37, region.name, {
      color: "#edf2f7",
      fontFamily: "system-ui, sans-serif",
      fontSize: "13px",
      backgroundColor: "#070b12dd",
      padding: { x: 6, y: 3 },
    }).setOrigin(0.5);

    const status = this.add.text(0, 0, "?", {
      color: "#ffffff",
      fontFamily: "Georgia, serif",
      fontSize: "15px",
      fontStyle: "bold",
    }).setOrigin(0.5);

    container.add([halo, marker, status, label]);
    this.regionViews.set(region.id, { container, marker, label, status });
  }

  private planMove(regionId: RegionId): void {
    const state = gameEngine.getSnapshot().state;
    if (
      state.mode !== "strategy" ||
      state.strategy.phase !== "planning" ||
      state.strategy.currentRegionId === regionId
    ) return;
    const current = state.strategy.regions[state.strategy.currentRegionId];
    if (!current.connections.includes(regionId)) return;
    gameEngine.dispatch({
      type: "operations.submit_order",
      orderType: "move",
      destinationId: regionId,
    });
  }

  private refresh(): void {
    const strategy = gameEngine.getSnapshot().state.strategy;
    const current = strategy.regions[strategy.currentRegionId];
    const plannedDestination = strategy.playerOrder?.type === "move"
      ? strategy.playerOrder.destinationRegionId
      : undefined;
    const encounterRegions = new Set(strategy.encounterQueue.map(item => item.regionId));

    for (const line of this.links) {
      const from = strategy.regions[line.getData("from") as RegionId];
      const to = strategy.regions[line.getData("to") as RegionId];
      const visible = from.discovered || to.discovered;
      const planned = plannedDestination &&
        ((from.id === current.id && to.id === plannedDestination) ||
          (to.id === current.id && from.id === plannedDestination));
      line.setStrokeStyle(
        planned ? 5 : visible ? 3 : 1,
        planned ? 0xd4a3ff : visible ? 0x516176 : 0x28313f,
        planned ? 0.95 : visible ? 0.62 : 0.18,
      );
    }

    for (const [regionId, view] of this.regionViews) {
      const region = strategy.regions[regionId];
      const adjacent = current.connections.includes(regionId);
      const currentRegion = regionId === current.id;
      const controlled = region.controlledBy === STRATEGY_FACTION_ID;
      const planned = regionId === plannedDestination;
      const knownEnemy = regionId === strategy.knownEnemyRegionId;
      const encounterReady = encounterRegions.has(regionId);

      view.container.setAlpha(region.discovered ? 1 : adjacent ? 0.48 : 0.16);
      view.label.setText(region.discovered ? region.name : "未知区域");
      view.status.setText(
        currentRegion ? "◆" :
        encounterReady ? "!" :
        knownEnemy ? "L" :
        planned ? "→" :
        controlled ? "◇" :
        region.investigated ? "✓" :
        region.discovered ? "·" : "?",
      );

      if (currentRegion) view.marker.setStrokeStyle(5, 0xe4c676, 1).setFillStyle(0x514021, 1);
      else if (encounterReady) view.marker.setStrokeStyle(5, 0xe46e78, 1).setFillStyle(0x47212c, 1);
      else if (knownEnemy) view.marker.setStrokeStyle(5, 0xe26969, 1).setFillStyle(0x4b2024, 1);
      else if (planned) view.marker.setStrokeStyle(5, 0xd4a3ff, 1).setFillStyle(0x422c55, 1);
      else if (controlled) view.marker.setStrokeStyle(4, 0x6fc9bd, 1).setFillStyle(0x214641, 1);
      else if (adjacent && strategy.phase === "planning") view.marker.setStrokeStyle(3, 0x8ca9c8, 1).setFillStyle(0x26394f, 1);
      else view.marker.setStrokeStyle(2, 0x66758a, 0.85).setFillStyle(0x263242, 1);
    }
  }
}
