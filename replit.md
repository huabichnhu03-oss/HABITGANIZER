# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Features

- Habit tracker with streaks, completions, dashboard.
- **Rewards system**: completing a habit awards `COINS_PER_COMPLETION` (default 10) coins
  in a single-row `wallets` table (id `'default'`). Coins are spent in the Pups shop to buy
  dogs from a seeded `pets` catalog (Toby/Shiba, Biscuit/Corgi, Coco/Frenchie,
  Domino/Dalmatian, Mochi/Pomeranian, Sunny/Golden). Owned pets live in `user_pets`.
- Pet illustrations are PNGs in `artifacts/api-server/public/pets/` served at
  `/api/assets/pets/<slug>.png` via `express.static`.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
