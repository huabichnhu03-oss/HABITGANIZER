import React, { useEffect, useState } from "react";
import { useUser } from "@clerk/react";
import { MessageSquareHeart } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useFeedbackDialog } from "@/contexts/feedback-dialog-context";
import { isOnboardingCompleted } from "@/lib/onboarding-storage";
import {
  markFeedbackPromptShown,
  shouldShowFeedbackPrompt,
} from "@/lib/feedback-prompt-storage";
import { useTranslation } from "@/i18n";

const SHOW_DELAY_MS = 2500;

/**
 * Every 15 days (after first install + onboarding), ask signed-in web users for feedback.
 */
export function FeedbackPrompt() {
  const { user, isLoaded } = useUser();
  const { openFeedback } = useFeedbackDialog();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isLoaded || !user) return;
    if (!isOnboardingCompleted(user.id)) return;
    if (!shouldShowFeedbackPrompt(user.id)) return;

    const timer = window.setTimeout(() => {
      if (!shouldShowFeedbackPrompt(user.id)) return;
      markFeedbackPromptShown(user.id);
      setOpen(true);
    }, SHOW_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [isLoaded, user]);

  const dismiss = () => setOpen(false);

  const giveFeedback = () => {
    setOpen(false);
    openFeedback("prompt");
  };

  if (!isLoaded || !user) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss();
      }}
    >
      <DialogContent
        className="max-w-md border-4 border-foreground rounded-3xl shadow-[8px_8px_0_#141414] bg-background gap-5"
        onPointerDownOutside={(e) => e.preventDefault()}
        aria-describedby={undefined}
      >
        <DialogHeader className="text-left gap-2">
          <DialogTitle className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
            <MessageSquareHeart className="w-8 h-8 text-primary" strokeWidth={2.5} />
            {t("feedback.promptTitle")}
          </DialogTitle>
          <DialogDescription className="text-base font-semibold text-foreground">
            {t("feedback.promptBody")}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-col sm:flex-row gap-3 sm:justify-between sm:gap-4">
          <button
            type="button"
            className="text-xs font-black uppercase underline text-muted-foreground order-last sm:order-first"
            onClick={dismiss}
            data-testid="feedback-prompt-later"
          >
            {t("feedback.notNow")}
          </button>
          <Button
            type="button"
            data-testid="feedback-prompt-open"
            className="uppercase font-black border-2 border-foreground rounded-xl shadow-[4px_4px_0_#141414] active:translate-y-px active:shadow-none grow sm:grow-0"
            onClick={giveFeedback}
          >
            {t("feedback.send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
