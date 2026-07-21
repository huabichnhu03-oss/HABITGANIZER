/** Minimal GPT types for rewarded web ads — see https://developers.google.com/publisher-tag/samples/display-rewarded-ad */

declare namespace googletag {
  interface CommandArray {
    push(command: () => void): number;
  }

  interface Slot {
    addService(service: PubAdsService): Slot;
    getSlotElementId(): string;
  }

  interface PubAdsService {
    addEventListener(
      eventType: string,
      listener: (event: RewardedSlotReadyEvent | RewardedSlotGrantedEvent | RewardedSlotClosedEvent) => void,
    ): void;
    removeEventListener(
      eventType: string,
      listener: (event: RewardedSlotReadyEvent | RewardedSlotGrantedEvent | RewardedSlotClosedEvent) => void,
    ): void;
  }

  interface RewardedSlotReadyEvent {
    slot: Slot;
    makeRewardedVisible(): void;
  }

  interface RewardedSlotGrantedEvent {
    slot: Slot;
    payload?: { type?: string; amount?: number };
  }

  interface RewardedSlotClosedEvent {
    slot: Slot;
  }

  namespace enums {
    namespace OutOfPageFormat {
      const REWARDED: unknown;
    }
  }

  const cmd: CommandArray;
  let apiReady: boolean;

  function defineOutOfPageSlot(adUnitPath: string, format: unknown): Slot | null;
  function destroySlots(slots?: Slot[]): boolean;
  function display(slot: Slot | string): void;
  function enableServices(): void;
  function pubads(): PubAdsService;
}

interface Window {
  googletag?: typeof googletag;
}
