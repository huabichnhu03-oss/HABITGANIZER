import type { QueryClient } from "@tanstack/react-query";
import type { OwnedPet } from "./generated/api.schemas";
import { getGetCollectionQueryKey } from "./generated/api";

export function patchOwnedPetInCollectionCache(
  queryClient: QueryClient,
  updated: OwnedPet
): void {
  queryClient.setQueryData<OwnedPet[]>(getGetCollectionQueryKey(), (old) => {
    if (!old) return old;
    const idx = old.findIndex((p) => p.id === updated.id);
    if (idx === -1) return old;
    const next = [...old];
    next[idx] = updated;
    return next;
  });
}

export function optimisticallyRenamePetInCollectionCache(
  queryClient: QueryClient,
  petId: number,
  name: string
): OwnedPet[] | undefined {
  const key = getGetCollectionQueryKey();
  const previous = queryClient.getQueryData<OwnedPet[]>(key);
  if (!previous) return undefined;
  queryClient.setQueryData<OwnedPet[]>(
    key,
    previous.map((p) => (p.id === petId ? { ...p, name, nickname: name } : p))
  );
  return previous;
}

export function extractApiErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === "object" && err !== null) {
    const e = err as {
      response?: { data?: { error?: string } };
      data?: { error?: string } | null;
      message?: string;
    };
    const fromBody = e.response?.data?.error ?? e.data?.error;
    if (fromBody) return fromBody;
    return e.message ?? fallback;
  }
  return fallback;
}

/** Rewrites feed/water errors to use the current display name after a rename. */
export function formatPetCareErrorMessage(
  err: unknown,
  petName: string,
  fallback: string
): string {
  const raw = extractApiErrorMessage(err, fallback);
  const match = /^(.+?) isn't (hungry|thirsty) right now$/i.exec(raw);
  if (match) return `${petName} isn't ${match[2].toLowerCase()} right now`;
  return raw;
}
