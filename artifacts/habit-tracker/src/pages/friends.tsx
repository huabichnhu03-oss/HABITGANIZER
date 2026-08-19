import React, { useState } from "react";
import {
  useGetFriendProfile,
  usePatchFriendProfile,
  useListFriendRequests,
  useListFriends,
  useSendFriendRequest,
  useAcceptFriendRequest,
  useDeclineFriendRequest,
  useCancelFriendRequest,
  useRemoveFriend,
  type FriendRequestItem,
} from "@workspace/api-client-react";
import { Users, UserPlus, UserMinus, Copy, Check, Clock, X, Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ApiQueryErrorBanner } from "@/components/api-query-error-banner";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/i18n";

export function FriendsPage() {
  const { t } = useTranslation();
  const profileQuery = useGetFriendProfile();
  const requestsQuery = useListFriendRequests();
  const friendsQuery = useListFriends();

  const [addCode, setAddCode] = useState("");
  const [editName, setEditName] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);

  const { toast } = useToast();

  const patchProfile = usePatchFriendProfile({
    mutation: {
      onSuccess: () => {
        toast({ title: t("friends.nameUpdated"), variant: "success" });
        setIsEditingName(false);
        profileQuery.refetch();
      },
    },
  });

  const sendRequest = useSendFriendRequest({
    mutation: {
      onSuccess: (data) => {
        if (data.becameFriends) {
          toast({ title: t("friends.nowFriends"), variant: "success" });
        } else {
          toast({ title: t("friends.requestSent"), variant: "success" });
        }
        setAddCode("");
        requestsQuery.refetch();
        friendsQuery.refetch();
      },
      onError: () => {
        toast({ title: t("friends.sendFailed"), description: t("friends.sendFailedHint"), variant: "destructive" });
      },
    },
  });

  const acceptRequest = useAcceptFriendRequest({
    mutation: {
      onSuccess: () => {
        toast({ title: t("friends.requestAccepted"), variant: "success" });
        requestsQuery.refetch();
        friendsQuery.refetch();
      },
    },
  });

  const declineRequest = useDeclineFriendRequest({
    mutation: {
      onSuccess: () => {
        requestsQuery.refetch();
      },
    },
  });

  const cancelRequest = useCancelFriendRequest({
    mutation: {
      onSuccess: () => {
        requestsQuery.refetch();
      },
    },
  });

  const removeFriend = useRemoveFriend({
    mutation: {
      onSuccess: () => {
        toast({ title: t("friends.friendRemoved"), variant: "success" });
        friendsQuery.refetch();
      },
    },
  });

  const isLoading = profileQuery.isLoading || requestsQuery.isLoading || friendsQuery.isLoading;

  if (profileQuery.isError || requestsQuery.isError || friendsQuery.isError) {
    return (
      <div className="space-y-8">
        <ApiQueryErrorBanner
          title={t("friends.loadFailed")}
          onRetry={() => {
            void profileQuery.refetch();
            void requestsQuery.refetch();
            void friendsQuery.refetch();
          }}
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="h-12 w-64 bg-muted border-brutal shadow-brutal rounded-2xl animate-pulse" />
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2">
          {[1, 2, 3].map(i => <div key={i} className="h-48 bg-muted border-brutal shadow-brutal rounded-[2rem] animate-pulse" />)}
        </div>
      </div>
    );
  }

  const profile = profileQuery.data!;
  const requestsSummary = requestsQuery.data ?? { incoming: [], outgoing: [] };
  const friends = friendsQuery.data ?? [];

  const incoming = requestsSummary.incoming;
  const outgoing = requestsSummary.outgoing;

  function handleCopyCode() {
    navigator.clipboard.writeText(profile.friendCode).then(() => {
      toast({ title: t("friends.codeCopied"), variant: "success" });
    });
  }

  function handleSendRequest() {
    const code = addCode.trim().toUpperCase();
    if (!code) return;
    sendRequest.mutate({ data: { friendCode: code } });
  }

  function handleSaveName() {
    const name = editName.trim();
    if (!name) return;
    patchProfile.mutate({ data: { displayName: name } });
  }

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex items-center gap-4">
        <Users className="w-10 h-10 text-foreground drop-shadow-[2px_2px_0_rgba(0,0,0,1)] -rotate-6" />
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tighter text-foreground">{t("friends.title")}</h1>
          <p className="text-muted-foreground font-medium">{t("friends.subtitle")}</p>
        </div>
      </header>

      {/* {t("friends.yourProfile")} Card */}
      <Card className="border-brutal shadow-brutal rounded-[2rem] overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-black uppercase tracking-tight text-foreground">{t("friends.yourProfile")}</h2>
            <button
              onClick={() => {
                setEditName(profile.displayName);
                setIsEditingName(!isEditingName);
              }}
              className="text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
            >
              {isEditingName ? t("common.cancel") : t("friends.editName")}
            </button>
          </div>

          {isEditingName ? (
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                maxLength={80}
                placeholder={t("friends.displayName")}
                className="flex-1 rounded-xl border-2 border-border bg-background px-4 py-2 font-medium text-foreground"
              />
              <button
                onClick={handleSaveName}
                disabled={patchProfile.isPending}
                className="rounded-xl border-2 border-border bg-primary px-4 py-2 font-bold text-white shadow-[2px_2px_0_hsl(var(--foreground))] active:translate-y-px active:shadow-none transition-all disabled:opacity-50"
              >
                Save
              </button>
            </div>
          ) : (
            <p className="text-lg font-bold text-foreground mb-4">{profile.displayName || t("friends.noName")}</p>
          )}

          <div className="flex items-center gap-3">
            <div className="flex-1 rounded-xl border-2 border-dashed border-border bg-muted px-4 py-3">
              <p className="text-xs font-bold text-muted-foreground uppercase mb-1">{t("friends.friendCode")}</p>
              <p className="text-2xl font-black tracking-widest text-foreground font-mono">{profile.friendCode}</p>
            </div>
            <button
              onClick={handleCopyCode}
              className="rounded-xl border-2 border-border bg-secondary px-4 py-3 font-bold text-foreground shadow-[2px_2px_0_hsl(var(--foreground))] active:translate-y-px active:shadow-none transition-all"
              title={t("friends.copyCode")}
            >
              <Copy className="w-5 h-5" />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* {t("friends.addFriend")} */}
      <Card className="border-brutal shadow-brutal rounded-[2rem] overflow-hidden">
        <CardContent className="p-6">
          <h2 className="text-xl font-black uppercase tracking-tight text-foreground mb-4 flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            {t("friends.addFriend")}
          </h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={addCode}
              onChange={e => setAddCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && handleSendRequest()}
              maxLength={10}
              placeholder={t("friends.enterCode")}
              className="flex-1 rounded-xl border-2 border-border bg-background px-4 py-3 font-mono font-bold text-foreground tracking-wider uppercase"
            />
            <button
              onClick={handleSendRequest}
              disabled={sendRequest.isPending || !addCode.trim()}
              className="rounded-xl border-2 border-border bg-primary px-6 py-3 font-bold text-white shadow-[2px_2px_0_hsl(var(--foreground))] active:translate-y-px active:shadow-none transition-all disabled:opacity-50"
            >
              {sendRequest.isPending ? t("friends.sending") : t("friends.send")}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* {t("friends.incoming")} */}
      {incoming.length > 0 && (
        <Card className="border-brutal shadow-brutal rounded-[2rem] overflow-hidden">
          <CardContent className="p-6">
            <h2 className="text-xl font-black uppercase tracking-tight text-foreground mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              {t("friends.incoming")} ({incoming.length})
            </h2>
            <div className="space-y-3">
              {incoming.map((req: FriendRequestItem) => (
                <div key={req.id} className="flex items-center justify-between rounded-xl border-2 border-border bg-muted px-4 py-3">
                  <div>
                    <p className="font-bold text-foreground">{req.fromDisplayName || t("friends.unknown")}</p>
                    <p className="text-xs text-muted-foreground font-mono">{req.fromFriendCode}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => acceptRequest.mutate({ requestId: req.id })}
                      disabled={acceptRequest.isPending}
                      className="rounded-lg border-2 border-border bg-green-500 px-3 py-1.5 text-sm font-bold text-white shadow-[2px_2px_0_hsl(var(--foreground))] active:translate-y-px active:shadow-none transition-all"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => declineRequest.mutate({ requestId: req.id })}
                      disabled={declineRequest.isPending}
                      className="rounded-lg border-2 border-border bg-destructive px-3 py-1.5 text-sm font-bold text-white shadow-[2px_2px_0_hsl(var(--foreground))] active:translate-y-px active:shadow-none transition-all"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Outgoing Requests */}
      {outgoing.length > 0 && (
        <Card className="border-brutal shadow-brutal rounded-[2rem] overflow-hidden">
          <CardContent className="p-6">
            <h2 className="text-xl font-black uppercase tracking-tight text-foreground mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              {t("friends.pending")} ({outgoing.length})
            </h2>
            <div className="space-y-3">
              {outgoing.map((req: FriendRequestItem) => (
                <div key={req.id} className="flex items-center justify-between rounded-xl border-2 border-border bg-muted px-4 py-3">
                  <div>
                    <p className="font-bold text-foreground">{req.toDisplayName || t("friends.unknown")}</p>
                    <p className="text-xs text-muted-foreground font-mono">{req.toFriendCode}</p>
                  </div>
                  <button
                    onClick={() => cancelRequest.mutate({ requestId: req.id })}
                    disabled={cancelRequest.isPending}
                    className="rounded-lg border-2 border-border bg-secondary px-3 py-1.5 text-sm font-bold text-foreground shadow-[2px_2px_0_hsl(var(--foreground))] active:translate-y-px active:shadow-none transition-all"
                  >
                    Cancel
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Friends List */}
      <Card className="border-brutal shadow-brutal rounded-[2rem] overflow-hidden">
        <CardContent className="p-6">
          <h2 className="text-xl font-black uppercase tracking-tight text-foreground mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5" />
            {t("friends.yourFriends")} ({friends.length})
          </h2>
          {friends.length === 0 ? (
            <p className="text-muted-foreground font-medium text-center py-8">
              {t("friends.noFriends")}</p>
          ) : (
            <div className="space-y-3">
              {friends.map(f => (
                <div key={f.walletId} className="flex items-center justify-between rounded-xl border-2 border-border bg-muted px-4 py-3">
                  <div>
                    <p className="font-bold text-foreground">{f.displayName || t("friends.unknown")}</p>
                    <p className="text-xs text-muted-foreground font-mono">{f.friendCode}</p>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm(`Remove ${f.displayName || "this friend"}?`)) {
                        removeFriend.mutate({ walletId: f.walletId });
                      }
                    }}
                    disabled={removeFriend.isPending}
                    className="rounded-lg border-2 border-border bg-secondary px-3 py-1.5 text-sm font-bold text-foreground shadow-[2px_2px_0_hsl(var(--foreground))] active:translate-y-px active:shadow-none transition-all hover:bg-destructive hover:text-white"
                    title={t("friends.remove")}
                  >
                    <UserMinus className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
