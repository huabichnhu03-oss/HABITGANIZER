import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit runs with cwd = this package (`lib/db`), so shell env rarely
 * includes root `.env`. Load repo-root `.env` when DATABASE_URL is missing.
 */
function findWorkspaceRootDotenv(startDir: string): string | null {
  let dir = path.resolve(startDir);
  while (true) {
    const candidate = path.join(dir, ".env");
    const marker = path.join(dir, "pnpm-workspace.yaml");
    if (fs.existsSync(candidate) && fs.existsSync(marker)) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function loadRootDotenv(): void {
  if (process.env.DATABASE_URL) return;

  const rootEnv = findWorkspaceRootDotenv(process.cwd());
  if (!rootEnv || !fs.existsSync(rootEnv)) return;

  const raw = fs.readFileSync(rootEnv, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    if (!key || process.env[key] !== undefined) continue;

    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadRootDotenv();

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is missing. Put it in the repo root `.env` or export it before `pnpm --filter @workspace/db run push`.",
  );
}

export default defineConfig({
  schema: "./src/schema/*.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});