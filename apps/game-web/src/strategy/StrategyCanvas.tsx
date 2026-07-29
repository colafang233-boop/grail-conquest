import { useEffect, useRef } from "react";
import Phaser from "phaser";
import { StrategyMapScene } from "./StrategyMapScene";

export function StrategyCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: container,
      width: 790,
      height: 430,
      backgroundColor: "#080d15",
      scene: [StrategyMapScene],
      render: { antialias: true },
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    });
    return () => game.destroy(true);
  }, []);

  return <div ref={containerRef} className="strategy-canvas" aria-label="冬木市战略地图" />;
}
