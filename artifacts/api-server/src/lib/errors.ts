import type { Response } from "express";

/**
 * Send a 400 response with Zod validation error details.
 * In production, returns a generic message; in development, includes field errors.
 */
export function sendZodError(res: Response, err: { issues: Array<{ path: (string | number)[]; message: string }> }): void {
  const issues = err.issues.map((i) => ({
    path: i.path.join("."),
    message: i.message,
  }));
  res.status(400).json({
    error: "Validation failed",
    details: process.env.NODE_ENV === "production" ? undefined : issues,
  });
}

/**
 * Send a generic error response. Never leaks internal details.
 */
export function sendError(res: Response, status: number, message: string): void {
  res.status(status).json({ error: message });
}
