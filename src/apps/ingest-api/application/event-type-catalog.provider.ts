import type { RuntimeEventTypeView } from '@/contracts/event-type-runtime';

export abstract class EventTypeCatalogProvider {
  abstract getByKeys(keys: string[]): Record<string, RuntimeEventTypeView | null>;
  abstract isReady(): boolean;
}
