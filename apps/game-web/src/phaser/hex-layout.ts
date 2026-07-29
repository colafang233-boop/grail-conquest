import type { HexCoord } from "@grail/core";

export interface PixelPosition {
  readonly x: number;
  readonly y: number;
}

export function hexToPixel(
  coord: HexCoord,
  size: number,
  offsetX: number,
  offsetY: number,
): PixelPosition {
  return {
    x: offsetX + size * Math.sqrt(3) * (coord.q + coord.r / 2),
    y: offsetY + size * 1.5 * coord.r,
  };
}

export function createHexPoints(size: number): readonly number[] {
  const points: number[] = [];

  for (let index = 0; index < 6; index += 1) {
    const angle = (Math.PI / 180) * (60 * index - 30);
    points.push(Math.cos(angle) * size, Math.sin(angle) * size);
  }

  return points;
}
