import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ProfileAccountDialog, type TabKey } from "@/components/profile-account-dialog";

export type ProfileDialogTab = TabKey;

type ProfileDialogContextValue = {
  openProfile: (initialTab?: ProfileDialogTab) => void;
};

const ProfileDialogContext = createContext<ProfileDialogContextValue | null>(null);

export function ProfileAccountProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [initialTab, setInitialTab] = useState<ProfileDialogTab>("manage");

  const openProfile = useCallback((tab: ProfileDialogTab = "manage") => {
    setInitialTab(tab);
    setOpen(true);
  }, []);

  const value = useMemo(() => ({ openProfile }), [openProfile]);

  return (
    <ProfileDialogContext.Provider value={value}>
      {children}
      <ProfileAccountDialog open={open} onOpenChange={setOpen} initialTab={initialTab} />
    </ProfileDialogContext.Provider>
  );
}

export function useProfileAccount(): ProfileDialogContextValue {
  const ctx = useContext(ProfileDialogContext);
  if (!ctx) throw new Error("useProfileAccount must be used within ProfileAccountProvider");
  return ctx;
}
