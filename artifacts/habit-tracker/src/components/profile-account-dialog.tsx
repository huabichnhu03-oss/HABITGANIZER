import React, { useEffect, useState } from "react";
import { UserProfile, useUser } from "@clerk/react";
import { useLocation } from "wouter";
import {
  Users,
  History as HistoryIcon,
  Trophy,
  Crown,
  ChevronRight,
  UserRound,
  Shield,
  LogOut,
  MessageSquareHeart,
} from "lucide-react";
import { useClerk } from "@clerk/react";
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
import { useFeedbackDialog } from "@/contexts/feedback-dialog-context";
import { createClerkAppearance } from "@/lib/clerk-appearance";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";
import { LanguageSelect } from "@/components/language-select";

export type TabKey = "manage" | "about" | "account";

export type ProfileAccountDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Applied when the dialog opens. */
  initialTab?: TabKey;
};

type MetaShape = Record<string, unknown>;

const MANAGE_LINKS = [
  {
    href: "/friends",
    labelKey: "nav.friends",
    descKey: "settings.friendsDesc",
    icon: Users,
    testId: "settings-link-friends",
  },
  {
    href: "/history",
    labelKey: "nav.history",
    descKey: "settings.historyDesc",
    icon: HistoryIcon,
    testId: "settings-link-history",
  },
  {
    href: "/leaderboard",
    labelKey: "nav.ranks",
    descKey: "settings.ranksDesc",
    icon: Trophy,
    testId: "settings-link-ranks",
  },
  {
    href: "/premium",
    labelKey: "nav.premium",
    descKey: "settings.premiumDesc",
    icon: Crown,
    testId: "settings-link-premium",
  },
] as const;

function readMeta(user: NonNullable<ReturnType<typeof useUser>["user"]>): MetaShape {
  return (user.unsafeMetadata ?? {}) as MetaShape;
}

export function ProfileAccountDialog({
  open,
  onOpenChange,
  initialTab = "manage",
}: ProfileAccountDialogProps) {
  const { toast } = useToast();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { openFeedback } = useFeedbackDialog();
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
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

  const goTo = (href: string) => {
    onOpenChange(false);
    setLocation(href);
  };

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
      toast({ title: t("settings.profileSaved") });
    } catch (err) {
      toast({
        title: t("settings.profileSaveFailed"),
        description: err instanceof Error ? err.message : t("settings.tryAgain"),
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
          <DialogTitle className="font-black uppercase tracking-tight text-xl">{t("settings.title")}</DialogTitle>
          <DialogDescription>
            {t("settings.description")}
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as TabKey)}
          className="flex min-h-0 flex-1 flex-col gap-3 px-5 sm:px-6 pb-2 min-w-0"
        >
          <TabsList className="grid w-full grid-cols-3 shrink-0 border-2 border-foreground rounded-xl bg-accent p-1 h-auto">
            <TabsTrigger
              value="manage"
              className="uppercase font-black text-[10px] xs:text-xs data-[state=active]:shadow-[3px_3px_0_#141414]"
            >
              {t("settings.tabManage")}
            </TabsTrigger>
            <TabsTrigger
              value="about"
              className="uppercase font-black text-[10px] xs:text-xs data-[state=active]:shadow-[3px_3px_0_#141414]"
            >
              {t("settings.tabProfile")}
            </TabsTrigger>
            <TabsTrigger
              value="account"
              className="uppercase font-black text-[10px] xs:text-xs data-[state=active]:shadow-[3px_3px_0_#141414]"
            >
              {t("settings.tabAccount")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manage" className="mt-0 flex-1 overflow-y-auto overflow-x-hidden min-h-0 min-w-0 space-y-3 pr-1 -mr-0.5">
            <p className="text-sm font-medium text-muted-foreground">
              {t("settings.manageIntro")}
            </p>

            <div className="rounded-xl border-2 border-foreground bg-white p-3 space-y-2 shadow-[3px_3px_0_#141414]">
              <div>
                <p className="font-black uppercase text-sm tracking-wide">{t("language.label")}</p>
                <p className="text-xs font-medium text-muted-foreground">{t("language.description")}</p>
              </div>
              <LanguageSelect id="settings-language-select" showLabel={false} />
            </div>

            <div className="space-y-2">
              {MANAGE_LINKS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.href}
                    type="button"
                    data-testid={item.testId}
                    onClick={() => goTo(item.href)}
                    className="w-full flex items-center gap-3 rounded-xl border-2 border-foreground bg-white p-3 text-left hover:bg-muted active:translate-y-px transition-all shadow-[3px_3px_0_#141414]"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-foreground bg-accent">
                      <Icon className="w-5 h-5" strokeWidth={2.5} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-black uppercase text-sm tracking-wide">{t(item.labelKey)}</span>
                      <span className="block text-xs font-medium text-muted-foreground truncate">
                        {t(item.descKey)}
                      </span>
                    </span>
                    <ChevronRight className="w-5 h-5 shrink-0 text-muted-foreground" strokeWidth={2.5} />
                  </button>
                );
              })}
            </div>

            <div className="pt-1 space-y-2">
              <button
                type="button"
                data-testid="settings-link-feedback"
                onClick={() => {
                  onOpenChange(false);
                  openFeedback("settings");
                }}
                className="w-full flex items-center gap-3 rounded-xl border-2 border-foreground bg-white p-3 text-left hover:bg-muted active:translate-y-px transition-all shadow-[3px_3px_0_#141414]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-foreground bg-accent">
                  <MessageSquareHeart className="w-5 h-5" strokeWidth={2.5} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-black uppercase text-sm tracking-wide">{t("settings.sendFeedback")}</span>
                  <span className="block text-xs font-medium text-muted-foreground truncate">
                    {t("settings.sendFeedbackDesc")}
                  </span>
                </span>
                <ChevronRight className="w-5 h-5 shrink-0 text-muted-foreground" strokeWidth={2.5} />
              </button>
              <button
                type="button"
                onClick={() => setTab("about")}
                className="w-full flex items-center gap-3 rounded-xl border-2 border-foreground bg-white p-3 text-left hover:bg-muted transition-all"
              >
                <UserRound className="w-5 h-5 shrink-0" strokeWidth={2.5} />
                <span className="flex-1 font-black uppercase text-sm tracking-wide">{t("settings.editProfile")}</span>
                <ChevronRight className="w-5 h-5 shrink-0 text-muted-foreground" />
              </button>
              <button
                type="button"
                onClick={() => setTab("account")}
                className="w-full flex items-center gap-3 rounded-xl border-2 border-foreground bg-white p-3 text-left hover:bg-muted transition-all"
              >
                <Shield className="w-5 h-5 shrink-0" strokeWidth={2.5} />
                <span className="flex-1 font-black uppercase text-sm tracking-wide">{t("settings.emailSecurity")}</span>
                <ChevronRight className="w-5 h-5 shrink-0 text-muted-foreground" />
              </button>
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  void signOut();
                }}
                data-testid="settings-sign-out"
                className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-white px-4 py-3 font-black uppercase text-sm tracking-wide hover:bg-muted transition-all"
              >
                <LogOut className="w-4 h-4" /> {t("common.signOut")}
              </button>
            </div>
          </TabsContent>

          <TabsContent value="about" className="mt-0 flex-1 overflow-y-auto overflow-x-hidden min-h-0 min-w-0 space-y-4 pr-1 -mr-0.5">
            <div className="space-y-2">
              <Label htmlFor="profile-first-name" className="font-black uppercase text-xs tracking-wider">
                {t("settings.preferredName")}
              </Label>
              <Input
                id="profile-first-name"
                value={firstName}
                maxLength={50}
                onChange={(e) => setFirstName(e.target.value)}
                className="border-2 border-foreground rounded-xl font-semibold bg-white"
                placeholder={t("settings.namePlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-birthday" className="font-black uppercase text-xs tracking-wider">
                {t("settings.birthday")}{" "}
                <span className="font-normal text-muted-foreground normal-case">{t("common.optional")}</span>
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
                {t("settings.phone")}{" "}
                <span className="font-normal text-muted-foreground normal-case">{t("common.optional")}</span>
              </Label>
              <Input
                id="profile-phone"
                type="tel"
                value={phone}
                maxLength={32}
                onChange={(e) => setPhone(e.target.value)}
                className="border-2 border-foreground rounded-xl bg-white font-medium"
                placeholder="+84 …"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-bio" className="font-black uppercase text-xs tracking-wider">
                {t("settings.shortNote")}{" "}
                <span className="font-normal text-muted-foreground normal-case">{t("common.optional")}</span>
              </Label>
              <Textarea
                id="profile-bio"
                value={bio}
                maxLength={280}
                rows={3}
                onChange={(e) => setBio(e.target.value)}
                className="border-2 border-foreground rounded-xl bg-white font-medium resize-none"
                placeholder={t("settings.bioPlaceholder")}
              />
            </div>
            <div className="rounded-xl border-brutal-sm bg-white p-3 text-sm font-medium space-y-1">
              <p className="text-muted-foreground text-xs uppercase font-black tracking-wider">{t("settings.signedInEmail")}</p>
              <p className="font-bold truncate">{email ?? t("settings.noneOnFile")}</p>
              <button
                type="button"
                onClick={() => setTab("account")}
                className="text-primary font-black text-xs underline uppercase mt-1"
              >
                {t("settings.changeEmail")}
              </button>
            </div>
            <Button
              type="button"
              disabled={busy || !user}
              className="w-full uppercase font-black border-2 border-foreground shadow-[4px_4px_0_#141414] rounded-xl active:translate-y-px active:shadow-none"
              onClick={() => saveAbout()}
            >
              {t("settings.saveProfile")}
            </Button>
          </TabsContent>

          <TabsContent value="account" className="mt-0 flex flex-1 min-h-0 flex-col gap-3 overflow-hidden">
            <p className="text-sm font-medium text-muted-foreground shrink-0">
              {t("settings.accountIntro")}
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
