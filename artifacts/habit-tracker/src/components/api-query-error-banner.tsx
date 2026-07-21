import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

const DEFAULT_HINT =
  "The browser could not reach the API. In one terminal run the API (for example: pnpm --filter @workspace/api-server run dev:local). " +
  "Use VITE_DEV_PORT=5173 in your root .env for the web app and PORT=3001 for the API so they do not fight for the same port. " +
  "Optional: set API_URL=http://localhost:3001 so Vite’s proxy knows where to forward /api.";

export function ApiQueryErrorBanner({
  onRetry,
  title = "Can’t reach the server",
  children,
}: {
  onRetry: () => void;
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border-[3px] border-foreground bg-white p-6 sm:p-8 shadow-brutal text-center space-y-4 max-w-lg mx-auto">
      <p className="font-black text-xl uppercase tracking-tight">{title}</p>
      <p className="text-sm font-bold text-muted-foreground leading-relaxed">{children ?? DEFAULT_HINT}</p>
      <Button type="button" onClick={onRetry} className="font-black uppercase">
        Retry
      </Button>
    </div>
  );
}
