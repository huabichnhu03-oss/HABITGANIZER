import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "../public");
const legalDir = path.join(publicDir, "legal");
const webBuildDir = path.resolve(__dirname, "../../habit-tracker/dist/public");

function sendLegalPage(file: string) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    const filePath = path.join(legalDir, file);
    if (!fs.existsSync(filePath)) {
      next();
      return;
    }
    res.type("html").sendFile(filePath, (err) => {
      if (err) next(err);
    });
  };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function sendSupportPage(_req: Request, res: Response, _next: NextFunction): void {
  const supportEmail = escapeHtml(process.env.SUPPORT_CONTACT_EMAIL?.trim() || "support@example.com");
  const body = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Support — HabitPup</title>
  <style>
    :root { color-scheme: light; }
    body {
      font-family: system-ui, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
      margin: 0 auto;
      max-width: 40rem;
      padding: 2rem 1.25rem 3rem;
      line-height: 1.55;
      color: #141414;
      background: #f8f0dc;
    }
    h1 { font-size: 1.5rem; margin-top: 0; }
    a { color: #3d72d4; font-weight: 600; }
    .card {
      background: #fff;
      border: 4px solid #141414;
      border-radius: 1rem;
      padding: 1.5rem;
      box-shadow: 6px 6px 0 #141414;
      margin-top: 1.25rem;
    }
    .muted { color: #4d4d4d; font-size: 0.9rem; }
  </style>
</head>
<body>
  <h1>HabitPup — Support</h1>
  <p>For help, billing questions, or privacy requests, contact:</p>
  <div class="card">
    <p><a href="mailto:${supportEmail}">${supportEmail}</a></p>
    <p class="muted">Set <code>SUPPORT_CONTACT_EMAIL</code> on the API server to replace this address in production.</p>
  </div>
  <p><a href="/privacy">Privacy policy</a></p>
</body>
</html>`;
  res.status(200).type("html").send(body);
}

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Clerk proxy must be mounted before body parsers — it streams raw bytes.
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

// Security headers (G4).
app.use(helmet({
  contentSecurityPolicy: false, // SPA serves inline scripts
  crossOriginEmbedderPolicy: false,
}));

// CORS: restrict to allowed origins (G3).
const allowedOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// In development, allow localhost ports for Vite dev server.
if (process.env.NODE_ENV !== "production") {
  for (let port = 5170; port <= 5180; port++) {
    allowedOrigins.push(`http://localhost:${port}`);
  }
  allowedOrigins.push("http://localhost:3001");
  allowedOrigins.push("http://localhost:5000");
}

app.use(
  cors({
    credentials: true,
    origin: (origin, cb) => {
      // Allow requests with no origin (server-to-server, mobile, curl).
      if (!origin) return cb(null, true);
      if (allowedOrigins.length === 0 && process.env.NODE_ENV !== "production") {
        return cb(null, true); // dev fallback when no CORS_ORIGINS set
      }
      if (allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`CORS origin not allowed: ${origin}`));
    },
  }),
);
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));

// Resolve the publishable key from the incoming request host so the same
// server can serve multiple Clerk custom domains.
app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

app.use("/api/assets", express.static(publicDir, { maxAge: "1d", fallthrough: true }));
app.use("/api", router);

// Public URLs for store submissions (Google Play / App Store) — work with or without SPA build.
app.get("/privacy", sendLegalPage("privacy.html"));
app.get("/support", sendSupportPage);

// In production, serve the built web app at the root path.
if (fs.existsSync(webBuildDir)) {
  app.use(express.static(webBuildDir, { maxAge: "1h", index: false }));
  app.get(/^\/(?!api\/).*/, (_req, res, next) => {
    res.sendFile(path.join(webBuildDir, "index.html"), (err) => {
      if (err) next(err);
    });
  });
}

// Global error handler — never leak stack traces or internal details (G2).
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const status = (err as { status?: number })?.status ?? 500;
  const message = status >= 500 ? "Internal server error" : (err as Error)?.message ?? "Bad request";
  if (status >= 500) {
    logger.error({ err }, "Unhandled error");
  }
  res.status(status).json({ error: message });
});

export default app;
