import React from "react";

/** 8x8 pixel art grids for toy items */
const TOY_GRIDS: Record<string, string[]> = {
  ball: [
    "........",
    "..XXXX..",
    ".XRRRRX.",
    "XRRWRRRX",
    "XRRRRRRX",
    "XRRRRRRX",
    ".XRRRRX.",
    "..XXXX..",
  ],
  rope: [
    "........",
    ".XX..XX.",
    "XBBXXBBX",
    "XBBXXBBX",
    ".XX..XX.",
    "........",
    "........",
    "........",
  ],
  frisbee: [
    "........",
    "..XXXX..",
    ".XPBBPX.",
    "XPBBBBPX",
    "XPBBBBPX",
    ".XPBBPX.",
    "..XXXX..",
    "........",
  ],
  plush: [
    ".XXXXXX.",
    "XBBBBBBX",
    "XBEBBEBX",
    "XBBNBBBX",
    "XBBBBBBX",
    "XBBBBBBX",
    ".XBBBBX.",
    "..XXXX..",
  ],
  puzzle: [
    "XXXXXXX.",
    "XBBBBBX.",
    "XBBBBBX.",
    "XBBBXXXX",
    "XBBBBBBX",
    "XBBBBBBX",
    "XXXXXXXX",
    "........",
  ],
};

/** Color palettes for each toy type */
const TOY_PALETTES: Record<string, Record<string, string>> = {
  ball: { X: "#2a2a2a", R: "#d4544a", W: "#ffffff" },
  rope: { X: "#5b3a1f", B: "#c8a882" },
  frisbee: { X: "#2a2a2a", P: "#f5b8c8", B: "#4258d6" },
  plush: { X: "#5b3a1f", B: "#f5b8c8", E: "#1a1a1a", N: "#d4544a" },
  puzzle: { X: "#2a2a2a", B: "#7fc66c" },
};

export function PixelToy({
  slug,
  size = 24,
}: {
  slug: string;
  size?: number;
}) {
  const grid = TOY_GRIDS[slug] ?? TOY_GRIDS.ball;
  const palette = TOY_PALETTES[slug] ?? TOY_PALETTES.ball;
  const rows = grid.length;
  const cols = grid[0]?.length ?? 8;
  const cellSize = size / cols;

  return (
    <svg
      width={size}
      height={(size * rows) / cols}
      viewBox={`0 0 ${cols} ${rows}`}
      shapeRendering="crispEdges"
      style={{ imageRendering: "pixelated" }}
    >
      {grid.map((row, y) =>
        [...row].map((ch, x) => {
          const fill = palette[ch];
          if (!fill) return null;
          return (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width={1}
              height={1}
              fill={fill}
            />
          );
        })
      )}
    </svg>
  );
}
