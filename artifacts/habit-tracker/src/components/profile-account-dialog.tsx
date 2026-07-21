import React, { useEffect, useState } from "react";
import { UserProfile, useUser } from "@clerk/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createClerkAppearance } from "@/lib/clerk-appearance";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type TabKey = "about" | "account";

export type ProfileAccountDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Applied when the dialog opens. */
  initialTab?: TabKey;
};

type MetaShape = Record<string, unknown>;

function readMeta(user: NonNullable<ReturnType<typeof useUser>["user"]>): MetaShape {
  return (user.unsafeMetadata ?? {}) as MetaShape;
}

export function ProfileAccountDialog({
  open,
  onOpenChange,
  initialTab = "about",
}: ProfileAccountDialogProps) {
  const { toast } = useToast();
  const { user } = useUser();
  const [tab, setTab] = useState<TabKey>(initialTab);

  const meta = user ? readMeta(user) : {};

  const [firstName, setFirstName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setTab(initialTab);
    setFirstName(user.firstName ?? "");
    const m = readMeta(user);
    setBirthday(typeof m.birthday === "string" ? m.birthday : "");
    setPhone(typeof m.phone === "string" ? m.phone : "");
    setBio(typeof m.bio === "string" ? m.bio : "");
  }, [open, initialTab, user]);

  const email = user?.primaryEmailAddress?.emailAddress ?? null;

  const saveAbout = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await user.update({
        firstName: firstName.trim() || undefined,
        unsafeMetadata: {
          ...meta,
          birthday: birthday || null,
          phone: phone.trim() || null,
          bio: bio.trim() || null,
        },
      });
      toast({ title: "Profile saved" });
    } catch (err) {
      toast({
        title: "Couldn’t save profile",
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setBusy(false);
    }
  };

  const viteBase = import.meta.env.BASE_URL.replace(/\/$/, "");
  const clerkBase = createClerkAppearance(viteBase || "/");
  /** Fits Clerk’s embedded card inside our dialog without forcing a fixed px width beyond the frame. */
  const clerkEmbeddedAppearance = {
    ...clerkBase,
    elements: {
      ...(clerkBase.elements ?? {}),
      rootBox: "!w-full !max-w-full flex justify-center overflow-x-hidden",
      scrollBox: "!w-full !max-w-full min-w-0",
      cardBox:
        "!w-full !max-w-full min-w-0 rounded-2xl overflow-x-hidden border-4 border-[#141414] !shadow-none",
    },
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          // Anchor to viewport insets (not 50% vertical translate) so tall content + brutal shadow stay on-screen.
          "!fixed !left-1/2 !top-[max(0.75rem,env(safe-area-inset-top))] !bottom-[max(0.75rem,env(safe-area-inset-bottom))]",
          "!translate-x-[-50%] !translate-y-0 !flex !flex-col !gap-4 !overflow-hidden !p-0 !pb-4 sm:!pb-5",
          "!w-[min(36rem,calc(100vw-1.25rem))] sm:!w-[min(36rem,calc(100vw-2rem))] !max-w-[min(36rem,calc(100vw-1.25rem))]",
          "min-h-0 border-4 border-foreground bg-background rounded-2xl shadow-[5px_5px_0_#141414] sm:rounded-3xl sm:shadow-[6px_6px_0_#141414] pt-14",
        )}
        aria-describedby={undefined}
      >
        <DialogHeader className="shrink-0 space-y-1.5 px-5 sm:px-6 pt-1 text-center sm:text-left">
          <DialogTitle className="font-black uppercase tracking-tight text-xl">Your profile</DialogTitle>
          <DialogDescription>
            Update how we greet you here. Use the Account tab for email, Gmail, passwords, and connected accounts.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as TabKey)}
          className="flex min-h-0 flex-1 flex-col gap-3 px-5 sm:px-6 pb-2 min-w-0"
        >
          <TabsList className="grid w-full grid-cols-2 shrink-0 border-2 border-foreground rounded-xl bg-accent p-1 h-auto">
            <TabsTrigger
              value="about"
              className="uppercase font-black text-xs data-[state=active]:shadow-[3px_3px_0_#141414]"
            >
              About you
            </TabsTrigger>
            <TabsTrigger
              value="account"
              className="uppercase font-black text-xs data-[state=active]:shadow-[3px_3px_0_#141414]"
            >
              Email & accounts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="about" className="mt-0 flex-1 overflow-y-auto overflow-x-hidden min-h-0 min-w-0 space-y-4 pr-1 -mr-0.5">
            <div className="space-y-2">
              <Label htmlFor="profile-first-name" className="font-black uppercase text-xs tracking-wider">
                Preferred name
              </Label>
              <Input
                id="profile-first-name"
                value={firstName}
                maxLength={50}
                onChange={(e) => setFirstName(e.target.value)}
                className="border-2 border-foreground rounded-xl font-semibold bg-white"
                placeholder="What should we call you?"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-birthday" className="font-black uppercase text-xs tracking-wider">
                Birthday <span className="font-normal text-muted-foreground normal-case">(optional)</span>
              </Label>
              <Input
                id="profile-birthday"
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
                className="border-2 border-foreground rounded-xl bg-white font-medium"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-phone" className="font-black uppercase text-xs tracking-wider">
                Phone <span className="font-normal text-muted-foreground normal-case">(optional)</span>
              </Label>
              <Input
                id="profile-phone"
                type="tel"
                value={phone}
                maxLength={32}
                onChange={(e) => setPhone(e.target.value)}
                className="border-2 border-foreground rounded-xl bg-white font-medium"
                placeholder="+1 …"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-bio" className="font-black uppercase text-xs tracking-wider">
                Short note <span className="font-normal text-muted-foreground normal-case">(optional)</span>
              </Label>
              <Textarea
                id="profile-bio"
                value={bio}
                maxLength={280}
                rows={3}
                onChange={(e) => setBio(e.target.value)}
                className="border-2 border-foreground rounded-xl bg-white font-medium resize-none"
                placeholder="A line about your goals helps future features feel personal."
              />
            </div>
            <div className="rounded-xl border-brutal-sm bg-white p-3 text-sm font-medium space-y-1">
              <p className="text-muted-foreground text-xs uppercase font-black tracking-wider">Signed-in email</p>
              <p className="font-bold truncate">{email ?? "None on file"}</p>
              <button
                type="button"
                onClick={() => setTab("account")}
                className="text-primary font-black text-xs underline uppercase mt-1"
              >
                Change email or connect Gmail →
              </button>
            </div>
            <Button
              type="button"
              disabled={busy || !user}
              className="w-full uppercase font-black border-2 border-foreground shadow-[4px_4px_0_#141414] rounded-xl active:translate-y-px active:shadow-none"
              onClick={() => saveAbout()}
            >
              Save profile
            </Button>
          </TabsContent>

          <TabsContent value="account" className="mt-0 flex flex-1 min-h-0 flex-col gap-3 overflow-hidden">
            <p className="text-sm font-medium text-muted-foreground shrink-0">
              Clerk hosts your passwords, MFA, Gmail / Google OAuth, and other sign-in methods here.
            </p>
            <div className="flex-1 min-h-[10rem] min-w-0 max-h-full overflow-y-auto overflow-x-hidden overscroll-contain rounded-xl border-brutal-sm bg-white p-1 sm:p-2">
              <UserProfile routing="hash" appearance={clerkEmbeddedAppearance} />
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
