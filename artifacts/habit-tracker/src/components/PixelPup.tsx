import React from "react";

const DOG_GRID = [
  "................",
  ".XX..........XX.",
  "XBBX........XBBX",
  "XBBBXXXXXXXXBBBX",
  "XBBBBBBBBBBBBBBX",
  "XBBEBBBBBBBBEBBX",
  "XBBBBBBNNBBBBBBX",
  "XBBBBBBNNBBBBBBX",
  "XBBBBBBBBBBBBBBX",
  "XBBBBBBBBBBBBBBX",
  ".XBBBBBBBBBBBBX.",
  ".XBBBBBBBBBBBBX.",
  ".XX.XX....XX.XX.",
  "................",
] as const;

const BEAVER_GRID = [...DOG_GRID.slice(0, 12), "..TTTTTTTTTTTT..", DOG_GRID[13]];

type PetPalette = { B: string; X: string; E: string; N: string; T?: string };

const PALETTES: Record<string, PetPalette> = {
  shiba: { B: "#e0a96d", X: "#5b3a1f", E: "#1a1a1a", N: "#1a1a1a" },
  corgi: { B: "#f0b878", X: "#4a2a14", E: "#1a1a1a", N: "#1a1a1a" },
  frenchie: { B: "#b8b3aa", X: "#2a2a2a", E: "#1a1a1a", N: "#1a1a1a" },
  dalmatian: { B: "#f5f1e6", X: "#1a1a1a", E: "#1a1a1a", N: "#1a1a1a" },
  pomeranian: { B: "#f3d9a4", X: "#7a4a1a", E: "#1a1a1a", N: "#1a1a1a" },
  golden: { B: "#f1c266", X: "#7a4a1a", E: "#1a1a1a", N: "#1a1a1a" },
  husky: { B: "#dfe7ee", X: "#3a4a55", E: "#5cb6e8", N: "#1a1a1a" },
  beagle: { B: "#e5b07a", X: "#3a2410", E: "#1a1a1a", N: "#1a1a1a" },
  poodle: { B: "#fff5e6", X: "#7a5a3a", E: "#1a1a1a", N: "#1a1a1a" },
  labrador: { B: "#dca769", X: "#5a3416", E: "#1a1a1a", N: "#1a1a1a" },
  "border-collie": { B: "#1f1f1f", X: "#f5f1e6", E: "#fcd34d", N: "#1a1a1a" },
  dachshund: { B: "#a85a2a", X: "#4a1f0a", E: "#1a1a1a", N: "#1a1a1a" },
  bulldog: { B: "#cdd4db", X: "#3d3d3d", E: "#1a1a1a", N: "#292524" },
  boxer: { B: "#c9a27a", X: "#1f1208", E: "#1a1a1a", N: "#1a1a1a" },
  samoyed: { B: "#f9fafb", X: "#94a3b8", E: "#2563eb", N: "#1a1a1a" },
  chihuahua: { B: "#d4a574", X: "#4a2c12", E: "#1a1a1a", N: "#1a1a1a" },
  doberman: { B: "#1c1917", X: "#b45309", E: "#fef3c7", N: "#1c1917" },
  akita: { B: "#c08457", X: "#3f2817", E: "#111827", N: "#1a1a1a" },
  bernese: { B: "#0f172a", X: "#e11d48", E: "#fbbf24", N: "#fafafa" },
  "aussie-shep": { B: "#1e3a5f", X: "#e2e8f0", E: "#3b82f6", N: "#0f172a" },
  "tabby-cat": { B: "#e8924a", X: "#4a3319", E: "#16a34a", N: "#f472b6" },
  "tuxedo-cat": { B: "#1e1e24", X: "#f8fafc", E: "#facc15", N: "#fca5a5" },
  otter: { B: "#8d6f56", X: "#3f342a", E: "#020617", N: "#fcd9bd" },
  beaver: { B: "#6b5344", X: "#2e2218", E: "#0f172a", N: "#d6cfc7", T: "#4a3625" },
};

function paletteFor(slug: string): PetPalette {
  return PALETTES[slug] ?? PALETTES.shiba;
}

function gridFor(slug: string): readonly string[] {
  return slug === "beaver" ? BEAVER_GRID : DOG_GRID;
}

function fill(ch: string, palette: PetPalette): string {
  switch (ch) {
    case "B":
      return palette.B;
    case "X":
      return palette.X;
    case "E":
      return palette.E;
    case "N":
      return palette.N;
    case "T":
      return palette.T ?? palette.X;
    default:
      return "#000000";
  }
}

export function PixelPup({
  slug,
  size = 240,
  walking = false,
}: {
  slug: string;
  size?: number;
  walking?: boolean;
}) {
  const palette = paletteFor(slug);
  const grid = gridFor(slug);
  const cols = grid[0].length;
  const rows = grid.length;
  const cells: React.ReactElement[] = [];
  for (let y = 0; y < rows; y++) {
    const row = grid[y];
    for (let x = 0; x < cols && x < row.length; x++) {
      const ch = row[x];
      if (ch === ".") continue;
      const color = fill(ch, palette);
      cells.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={color} />);
    }
  }
  return (
    <svg
      viewBox={`0 0 ${cols} ${rows}`}
      width={size}
      height={(size * rows) / cols}
      shapeRendering="crispEdges"
      style={{
        imageRendering: "pixelated",
        maxWidth: "100%",
        height: "auto",
        animation: walking ? "pup-bob 0.45s steps(2) infinite" : undefined,
      }}
    >
      <style>{`@keyframes pup-bob { 0% { transform: translateY(0) } 50% { transform: translateY(-4%) } 100% { transform: translateY(0) } }`}</style>
      {cells}
    </svg>
  );
}
