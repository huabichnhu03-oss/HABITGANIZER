import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const envDir = path.resolve(import.meta.dirname, "..", "..");

// Root `.env` uses `PORT` for the **API** (see .env.example). Vite must not bind
// to that same variable or the web dev server steals 3001 and the proxy targets
// the wrong process → `http proxy error` for every `/api/*` call.
export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, envDir, "");

  const rawWebPort = env.VITE_DEV_PORT ?? env.WEB_DEV_PORT ?? "5173";
  const webPort = Number(rawWebPort);
  if (Number.isNaN(webPort) || webPort <= 0) {
    throw new Error(`Invalid VITE_DEV_PORT / WEB_DEV_PORT: "${rawWebPort}"`);
  }

  // Never use PORT for the API proxy when it equals the Vite port. A stale shell
  // (`export PORT=5173`) or bad docs overrides root `.env` and breaks `/api`.
  const apiPortRaw = (env.PORT ?? "3001").trim();
  const apiPortNum = Number(apiPortRaw);
  const apiPort =
    apiPortRaw !== "" &&
    !Number.isNaN(apiPortNum) &&
    apiPortNum === webPort
      ? "3001"
      : apiPortRaw;
  const apiTarget =
    env.API_URL?.trim() || `http://127.0.0.1:${apiPort}`;

  return {
    envDir,
    base: env.BASE_PATH ?? "/",
    plugins: [
      react(),
      tailwindcss({ optimize: false }),
      ...(process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined
        ? [
            await import("@replit/vite-plugin-runtime-error-modal").then((m) => m.default()),
            await import("@replit/vite-plugin-cartographer").then((m) =>
              m.cartographer({
                root: path.resolve(import.meta.dirname, ".."),
              }),
            ),
            await import("@replit/vite-plugin-dev-banner").then((m) => m.devBanner()),
          ]
        : []),
    ],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
        "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
      },
      dedupe: ["react", "react-dom"],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
    },
    server: {
      port: webPort,
      strictPort: true,
      host: "0.0.0.0",
      allowedHosts: true,
      fs: {
        strict: true,
      },
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },
        // Legal pages are served by the API in production; mirror that in dev.
        "/privacy": { target: apiTarget, changeOrigin: true },
        "/support": { target: apiTarget, changeOrigin: true },
      },
    },
    preview: {
      port: webPort,
      host: "0.0.0.0",
      allowedHosts: true,
    },
  };
});
