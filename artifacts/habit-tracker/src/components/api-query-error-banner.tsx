import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";

export function ApiQueryErrorBanner({
  onRetry,
  title,
  children,
}: {
  onRetry: () => void;
  title?: string;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl border-[3px] border-foreground bg-white p-6 sm:p-8 shadow-brutal text-center space-y-4 max-w-lg mx-auto">
      <p className="font-black text-xl uppercase tracking-tight">{title ?? t("errors.cantReach")}</p>
      <p className="text-sm font-bold text-muted-foreground leading-relaxed">
        {children ?? t("errors.apiHint")}
      </p>
      <Button type="button" onClick={onRetry} className="font-black uppercase">
        {t("common.retry")}
      </Button>
    </div>
  );
}
