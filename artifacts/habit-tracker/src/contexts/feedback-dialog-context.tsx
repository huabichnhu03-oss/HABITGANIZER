import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { FeedbackDialog } from "@/components/feedback-dialog";
import type { FeedbackSource } from "@/lib/submit-feedback";

type FeedbackDialogContextValue = {
  openFeedback: (source?: FeedbackSource) => void;
};

const FeedbackDialogContext = createContext<FeedbackDialogContextValue | null>(null);

export function FeedbackDialogProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<FeedbackSource>("settings");

  const openFeedback = useCallback((nextSource: FeedbackSource = "settings") => {
    setSource(nextSource);
    setOpen(true);
  }, []);

  const value = useMemo(() => ({ openFeedback }), [openFeedback]);

  return (
    <FeedbackDialogContext.Provider value={value}>
      {children}
      <FeedbackDialog open={open} onOpenChange={setOpen} source={source} />
    </FeedbackDialogContext.Provider>
  );
}

export function useFeedbackDialog(): FeedbackDialogContextValue {
  const ctx = useContext(FeedbackDialogContext);
  if (!ctx) {
    throw new Error("useFeedbackDialog must be used within FeedbackDialogProvider");
  }
  return ctx;
}
