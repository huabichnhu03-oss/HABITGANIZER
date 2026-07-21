export * from "./generated/api";
export * from "./generated/api.schemas";
export {
  patchOwnedPetInCollectionCache,
  optimisticallyRenamePetInCollectionCache,
  extractApiErrorMessage,
  formatPetCareErrorMessage,
} from "./collection-cache";
export { setBaseUrl, setAuthTokenGetter, setExtraHeadersGetter } from "./custom-fetch";
export type { AuthTokenGetter } from "./custom-fetch";
