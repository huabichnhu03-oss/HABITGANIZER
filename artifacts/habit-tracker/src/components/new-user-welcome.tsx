import React, { useEffect, useState } from "react";
import { useUser } from "@clerk/react";
import { Star, PawPrint, BarChart2, List, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { isOnboardingCompleted, markOnboardingCompleted } from "@/lib/onboarding-storage";
import { useProfileAccount } from "@/contexts/profile-dialog-context";

const STEPS = 4;

type MetaShape = Record<string, unknown>;

export function NewUserWelcome() {
  const { user, isLoaded } = useUser();
  const { toast } = useToast();
  const { openProfile } = useProfileAccount();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  const [firstName, setFirstName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (!isLoaded || !user) return;
    if (isOnboardingCompleted(user.id)) return;

    const m = (user.unsafeMetadata ?? {}) as MetaShape;
    setFirstName(user.firstName ?? "");
    setBirthday(typeof m.birthday === "string" ? m.birthday : "");
    setPhone(typeof m.phone === "string" ? m.phone : "");
    setBio(typeof m.bio === "string" ? m.bio : "");
    setStep(0);
    setOpen(true);
  }, [isLoaded, user]);

  const closeAndComplete = () => {
    if (user) markOnboardingCompleted(user.id);
    setOpen(false);
  };

  const saveQuickProfileAndContinue = async () => {
    if (!user) return;
    setSavingProfile(true);
    try {
      const meta = { ...(user.unsafeMetadata ?? {}) } as MetaShape;
      await user.update({
        firstName: firstName.trim() || undefined,
        unsafeMetadata: {
          ...meta,
          birthday: birthday || null,
          phone: phone.trim() || null,
          bio: bio.trim() || null,
        },
      });
      toast({ title: "Saved your profile" });
      setStep(3);
    } catch (err) {
      toast({
        title: "Couldn’t save",
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const openManageAccounts = () => openProfile("account");

  if (!isLoaded || !user) return null;
  if (isOnboardingCompleted(user.id)) return null;

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) closeAndComplete();
        }}
      >
        <DialogContent
          className="max-w-lg border-4 border-foreground rounded-3xl shadow-[10px_10px_0_#141414] bg-background gap-6"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          aria-describedby={undefined}
        >
          <div className="flex gap-1.5 pt-2">
            {Array.from({ length: STEPS }, (_, i) => (
              <div
                key={i}
                className={`h-2 flex-1 rounded-full border border-foreground transition-colors ${i <= step ? "bg-primary" : "bg-muted"}`}
                aria-hidden
              />
            ))}
          </div>

          <DialogHeader className="text-left gap-3">
            {step === 0 && (
              <>
                <DialogTitle className="text-3xl font-black uppercase tracking-tight flex items-center gap-2">
                  <Star className="w-10 h-10 fill-accent text-foreground" strokeWidth={2} /> Welcome!
                </DialogTitle>
                <DialogDescription className="text-base font-semibold text-foreground">
                  Habiganize turns small daily ticks into streaks you can actually keep. You’re signed in — your habits and virtual pups stay with this account everywhere.
                </DialogDescription>
              </>
            )}
            {step === 1 && (
              <>
                <DialogTitle className="text-3xl font-black uppercase tracking-tight">Your rhythm</DialogTitle>
                <DialogDescription asChild>
                  <ul className="text-base font-semibold space-y-3 text-left list-none p-0 m-0 text-foreground">
                    <TourRow Icon={Star} title="Today" body="Tap habits to complete them — add a mood or note if you feel like journaling the moment." />
                    <TourRow Icon={List} title="Habits" body="Schedule which days count, tweak icons & colors; this is home base." />
                    <TourRow Icon={BarChart2} title="Stats & history" body="Spot streak patterns and skim past completions without losing the neo-brutalist vibe." />
                    <TourRow Icon={PawPrint} title="Pups" body="Earn coins and snacks as you stick with it — your companion grows with your consistency." />
                  </ul>
                </DialogDescription>
              </>
            )}
            {step === 2 && (
              <>
                <DialogTitle className="text-3xl font-black uppercase tracking-tight">About you</DialogTitle>
                <DialogDescription className="text-base font-semibold text-foreground">
                  Optional extras help us personalize greetings and tune future perks. Gmail and OAuth live in Clerk — open account settings anytime.
                </DialogDescription>
                <div className="grid gap-3 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="onb-name" className="font-black uppercase text-xs">
                      Preferred name
                    </Label>
                    <Input
                      id="onb-name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      maxLength={50}
                      className="border-2 border-foreground rounded-xl bg-white font-bold"
                      placeholder="Name or nickname"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="onb-bday" className="font-black uppercase text-xs">
                      Birthday
                    </Label>
                    <Input
                      id="onb-bday"
                      type="date"
                      value={birthday}
                      onChange={(e) => setBirthday(e.target.value)}
                      className="border-2 border-foreground rounded-xl bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="onb-phone" className="font-black uppercase text-xs">
                      Phone
                    </Label>
                    <Input
                      id="onb-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      maxLength={32}
                      className="border-2 border-foreground rounded-xl bg-white font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="onb-bio" className="font-black uppercase text-xs">
                      Quick note
                    </Label>
                    <Textarea
                      id="onb-bio"
                      rows={3}
                      value={bio}
                      maxLength={280}
                      onChange={(e) => setBio(e.target.value)}
                      className="border-2 border-foreground rounded-xl bg-white resize-none font-medium"
                    />
                  </div>
                  <div className="rounded-xl border-brutal-sm bg-white px-4 py-3 text-sm font-bold flex flex-wrap items-center justify-between gap-2">
                    <span>Gmail • email • passwords →</span>
                    <button
                      type="button"
                      className="text-primary underline uppercase font-black text-xs whitespace-nowrap"
                      onClick={openManageAccounts}
                    >
                      Open account hub
                    </button>
                  </div>
                </div>
              </>
            )}
            {step === 3 && (
              <>
                <DialogTitle className="text-3xl font-black uppercase tracking-tight">You’re ready</DialogTitle>
                <DialogDescription className="text-base font-semibold text-foreground space-y-2">
                  <p>Start on Today — add a habit if you haven’t yet. Tap your profile anytime from the sidebar (desktop) or top bar (mobile) to revisit these details.</p>
                  <p className="text-muted-foreground text-sm font-medium">Need Gmail or OAuth? Settings → Account.</p>
                </DialogDescription>
              </>
            )}
          </DialogHeader>

          <DialogFooter className="flex-col sm:flex-row gap-3 sm:justify-between sm:gap-4">
            <button
              type="button"
              className="text-xs font-black uppercase underline text-muted-foreground order-last sm:order-first"
              onClick={closeAndComplete}
              data-testid="onboarding-skip"
            >
              Skip for now
            </button>

            <div className="flex flex-col-reverse sm:flex-row gap-3 w-full sm:w-auto flex-1 sm:justify-end">
              {step > 0 && step < 3 && (
                <Button
                  type="button"
                  variant="outline"
                  className="uppercase font-black border-3 border-foreground rounded-xl shadow-[4px_4px_0_#141414] active:shadow-none bg-white"
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                >
                  Back
                </Button>
              )}
              {step === 0 && (
                <Button
                  type="button"
                  className="uppercase font-black border-3 border-foreground rounded-xl shadow-[4px_4px_0_#141414] active:translate-y-px active:shadow-none grow"
                  onClick={() => setStep(1)}
                >
                  Continue <ArrowRight className="w-4 h-4" />
                </Button>
              )}
              {step === 1 && (
                <Button
                  type="button"
                  className="uppercase font-black border-3 border-foreground rounded-xl shadow-[4px_4px_0_#141414] active:translate-y-px active:shadow-none grow"
                  onClick={() => setStep(2)}
                >
                  Sounds good →
                </Button>
              )}
              {step === 2 && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="uppercase font-black border-3 border-foreground rounded-xl shadow-[4px_4px_0_#141414] active:shadow-none bg-white shrink-0"
                    onClick={() => setStep(3)}
                    data-testid="onboarding-skip-details"
                  >
                    Skip details
                  </Button>
                  <Button
                    type="button"
                    disabled={savingProfile}
                    className="uppercase font-black border-3 border-foreground rounded-xl shadow-[4px_4px_0_#141414] active:translate-y-px active:shadow-none grow"
                    onClick={saveQuickProfileAndContinue}
                    data-testid="onboarding-save-profile"
                  >
                    Save & finish tour
                  </Button>
                </>
              )}
              {step === 3 && (
                <Button
                  type="button"
                  className="uppercase font-black border-3 border-foreground rounded-xl shadow-[4px_4px_0_#141414] active:translate-y-px active:shadow-none grow"
                  onClick={closeAndComplete}
                  data-testid="onboarding-done"
                >
                  Go to habits
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TourRow({
  Icon,
  title,
  body,
}: {
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  body: string;
}) {
  return (
    <li className="flex gap-3 items-start rounded-2xl border-brutal-sm bg-white p-4">
      <div className="shrink-0 w-11 h-11 rounded-xl border-2 border-foreground bg-primary flex items-center justify-center text-white">
        <Icon className="w-6 h-6" strokeWidth={3} />
      </div>
      <div>
        <p className="font-black uppercase tracking-tight text-lg leading-tight">{title}</p>
        <p className="font-medium text-muted-foreground text-sm mt-1">{body}</p>
      </div>
    </li>
  );
}
