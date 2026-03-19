import { Injectable } from '@nestjs/common';
import { EventTypeCatalogProvider } from '@/apps/ingest-api/application';
import { RuntimeEventTypeView } from '@/contracts/event-type-runtime';

@Injectable()
export class InMemoryEventTypeCatalogProvider extends EventTypeCatalogProvider {
  private readonly byKey = new Map<
    string,
    {
      eventType: RuntimeEventTypeView;
      updatedAtMs: number;
    }
  >();

  private ready = false;

  getByKeys(keys: string[]): Record<string, RuntimeEventTypeView | null> {
    const result: Record<string, RuntimeEventTypeView | null> = {};
    for (const key of keys) {
      result[key] = this.byKey.get(key)?.eventType ?? null;
    }
    return result;
  }

  isReady(): boolean {
    return this.ready;
  }

  markReady(): void {
    this.ready = true;
  }

  apply(eventType: RuntimeEventTypeView): void {
    const updatedAtMs = this.resolveUpdatedAtMs(eventType);
    const current = this.byKey.get(eventType.key);

    if (current && current.updatedAtMs > updatedAtMs) {
      return;
    }

    this.byKey.set(eventType.key, {
      eventType: {
        id: eventType.id,
        key: eventType.key,
        schema: eventType.schema ?? null,
        requiresExposure: eventType.requiresExposure,
        isArchived: eventType.isArchived,
        createdAt: eventType.createdAt,
        updatedAt: eventType.updatedAt,
      },
      updatedAtMs: Number.isFinite(updatedAtMs) ? updatedAtMs : Date.now(),
    });
  }
  reset(): void {
    this.byKey.clear();
    this.ready = false;
  }

  private resolveUpdatedAtMs(eventType: RuntimeEventTypeView): number {
    return new Date(eventType.updatedAt ?? eventType.createdAt).getTime();
  }
}
