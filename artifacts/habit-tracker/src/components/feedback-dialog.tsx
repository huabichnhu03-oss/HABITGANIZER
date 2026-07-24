import React, { useEffect, useState } from "react";
import { MessageSquareHeart, Star } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { submitFeedback, type FeedbackSource } from "@/lib/submit-feedback";
import { cn } from "@/lib/utils";

const MESSAGE_MAX = 2000;

export type FeedbackDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source?: FeedbackSource;
};

export function FeedbackDialog({
  open,
  onOpenChange,
  source = "settings",
}: FeedbackDialogProps) {
  const { toast } = useToast();
  const [rating, setRating] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRating(null);
    setMessage("");
    setBusy(false);
  }, [open]);

  const canSubmit = Boolean(message.trim()) || rating != null;

  const handleSubmit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    try {
      await submitFeedback({
        message,
        rating,
        source,
        platform: "web",
      });
      toast({
        title: "Thanks for the feedback!",
        description: "We read every note and use it to improve Habiganize.",
      });
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Couldn’t send feedback",
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md border-4 border-foreground rounded-3xl shadow-[8px_8px_0_#141414] bg-background gap-5"
        aria-describedby={undefined}
      >
        <DialogHeader className="text-left gap-2">
          <DialogTitle className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
            <MessageSquareHeart className="w-8 h-8 text-primary" strokeWidth={2.5} />
            Send feedback
          </DialogTitle>
          <DialogDescription className="text-base font-semibold text-foreground">
            Tell us what you love, what’s confusing, or what you’d add next.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="font-black uppercase text-xs tracking-wider">
              Rating <span className="font-normal text-muted-foreground normal-case">(optional)</span>
            </Label>
            <div className="flex items-center gap-1.5" role="group" aria-label="Star rating">
              {[1, 2, 3, 4, 5].map((value) => {
                const active = rating != null && value <= rating;
                return (
                  <button
                    key={value}
                    type="button"
                    data-testid={`feedback-star-${value}`}
                    aria-label={`${value} star${value === 1 ? "" : "s"}`}
                    aria-pressed={rating === value}
                    onClick={() => setRating((prev) => (prev === value ? null : value))}
                    className={cn(
                      "p-1.5 rounded-xl border-2 border-foreground transition-all",
                      active ? "bg-accent shadow-[2px_2px_0_#141414]" : "bg-white hover:bg-muted",
                    )}
                  >
                    <Star
                      className={cn("w-6 h-6", active ? "fill-foreground text-foreground" : "text-muted-foreground")}
                      strokeWidth={2.5}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback-message" className="font-black uppercase text-xs tracking-wider">
              Your message
            </Label>
            <Textarea
              id="feedback-message"
              data-testid="feedback-message"
              value={message}
              maxLength={MESSAGE_MAX}
              rows={5}
              onChange={(e) => setMessage(e.target.value)}
              className="border-2 border-foreground rounded-xl bg-white font-medium resize-none"
              placeholder="What’s on your mind?"
            />
            <p className="text-xs font-medium text-muted-foreground text-right">
              {message.length}/{MESSAGE_MAX}
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-3 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="uppercase font-black border-2 border-foreground rounded-xl shadow-[3px_3px_0_#141414] bg-white"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            type="button"
            data-testid="feedback-submit"
            disabled={!canSubmit || busy}
            className="uppercase font-black border-2 border-foreground rounded-xl shadow-[4px_4px_0_#141414] active:translate-y-px active:shadow-none"
            onClick={() => void handleSubmit()}
          >
            {busy ? "Sending…" : "Send feedback"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
