import React from "react";

/** 8x8 pixel art grids for food items */
const FOOD_GRIDS: Record<string, string[]> = {
  kibble: [
    "........",
    "..XXXX..",
    ".XBBBBX.",
    "XBBBBBBX",
    "XBBBBBBX",
    "XBBBBBBX",
    ".XBBBBX.",
    "..XXXX..",
  ],
  treat: [
    "........",
    "..X.....",
    ".XBX....",
    "XBBBX...",
    "XBBBX...",
    ".XBX....",
    "..X.....",
    "........",
  ],
  premium: [
    "XXXXXXXX",
    "XBBBBBBX",
    "XBBBBBBX",
    "XBGBBGBX",
    "XBBBBBBX",
    "XBBBBBBX",
    "XBBBBBBX",
    "XXXXXXXX",
  ],
};

/** Color palettes for each food type */
const FOOD_PALETTES: Record<string, Record<string, string>> = {
  kibble: { X: "#5b3a1f", B: "#c8a882" },
  treat: { X: "#5b3a1f", B: "#d4544a" },
  premium: { X: "#2a2a2a", B: "#f5f1e6", G: "#7fc66c" },
};

export function PixelFood({
  slug,
  size = 24,
}: {
  slug: string;
  size?: number;
}) {
  const grid = FOOD_GRIDS[slug] ?? FOOD_GRIDS.kibble;
  const palette = FOOD_PALETTES[slug] ?? FOOD_PALETTES.kibble;
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
