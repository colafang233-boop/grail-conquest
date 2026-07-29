export interface HexCoord {
  readonly q: number;
  readonly r: number;
}

export const HEX_DIRECTIONS: readonly HexCoord[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export function hexKey(coord: HexCoord): string {
  return `${coord.q},${coord.r}`;
}

export function parseHexKey(key: string): HexCoord {
  const [q, r] = key.split(",").map(Number);

  if (q === undefined || r === undefined || Number.isNaN(q) || Number.isNaN(r)) {
    throw new Error(`Invalid hex key: ${key}`);
  }

  return { q, r };
}

export function hexEquals(left: HexCoord, right: HexCoord): boolean {
  return left.q === right.q && left.r === right.r;
}

export function hexDistance(left: HexCoord, right: HexCoord): number {
  const leftS = -left.q - left.r;
  const rightS = -right.q - right.r;

  return (
    Math.abs(left.q - right.q) +
    Math.abs(left.r - right.r) +
    Math.abs(leftS - rightS)
  ) / 2;
}

export function getHexNeighbors(coord: HexCoord): readonly HexCoord[] {
  return HEX_DIRECTIONS.map(direction => ({
    q: coord.q + direction.q,
    r: coord.r + direction.r,
  }));
}
