import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { AppLogger } from '@/shared/application';
import { RedisClientProvider } from './redis-client.provider';

type StreamEntry = [id: string, fields: string[]];
type StreamReadResult = Array<[stream: string, entries: StreamEntry[]]>;
export abstract class RedisSnapshotConsumer<T> implements OnModuleInit, OnModuleDestroy {
  private streamReader: Redis | null = null;

  private lastStreamId = '0-0';

  private running = true;

  private startupTimeout: NodeJS.Timeout | null = null;

  protected abstract readonly redisKey: string;

  protected abstract readonly redisStream: string;

  protected abstract readonly startupTimeoutMs: number;

  protected abstract parse(raw: string): T | null;

  protected abstract apply(item: T): void;

  protected abstract markReady(): void;

  protected abstract isReady(): boolean;

  constructor(
    protected readonly redis: RedisClientProvider,
    protected readonly logger: AppLogger,
  ) {}

  async onModuleInit(): Promise<void> {
    this.startupTimeout = setTimeout(() => {
      if (this.isReady()) return;

      this.markReady();
      this.logger.warn({
        event: 'redis.snapshot.consumer.timeout_ready',
        domain: 'infrastructure',
        operation: this.constructor.name,
        status: 'failure',
        meta: { redisKey: this.redisKey, timeoutMs: this.startupTimeoutMs },
      });
    }, this.startupTimeoutMs);
    this.startupTimeout.unref();

    try {
      const entries = await this.redis.getClient().hgetall(this.redisKey);
      for (const raw of Object.values(entries)) {
        this.applyRaw(raw);
      }
      this.markReady();
      this.clearStartupTimeout();
    } catch {
      this.logger.warn({
        event: 'redis.snapshot.consumer.hydration_failed',
        domain: 'infrastructure',
        operation: this.constructor.name,
        status: 'failure',
        meta: { redisKey: this.redisKey },
      });
    }
    void this.readStream();
  }

  async onModuleDestroy(): Promise<void> {
    this.clearStartupTimeout();
    this.running = false;
    const reader = this.streamReader;
    this.streamReader = null;
    reader?.disconnect();
  }

  private async readStream(): Promise<void> {
    const reader = this.redis.getClient().duplicate();
    this.streamReader = reader;
    reader.on('error', (error) => {
      this.logger.warn({
        event: 'redis.snapshot.consumer.stream_error',
        domain: 'infrastructure',
        operation: this.constructor.name,
        status: 'failure',
        meta: { error: error.message },
      });
    });

    try {
      const catchUp = (await reader.xread(
        'COUNT',
        '1000',
        'STREAMS',
        this.redisStream,
        this.lastStreamId,
      )) as StreamReadResult | null;
      this.processResult(catchUp);
      while (this.running) {
        try {
          const result = (await reader.xread(
            'COUNT',
            '100',
            'BLOCK',
            '5000',
            'STREAMS',
            this.redisStream,
            this.lastStreamId,
          )) as StreamReadResult | null;
          if (result) this.processResult(result);
        } catch {
          if (!this.running) break;
          this.logger.warn({
            event: 'redis.snapshot.consumer.stream_read_failed',
            domain: 'infrastructure',
            operation: this.constructor.name,
            status: 'failure',
            meta: { stream: this.redisStream, lastStreamId: this.lastStreamId },
          });
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    } finally {
      if (this.streamReader === reader) this.streamReader = null;
      reader.disconnect();
    }
  }

  private processResult(result: StreamReadResult | null): void {
    if (!result) return;

    for (const [, entries] of result) {
      for (const [id, fields] of entries) {
        this.lastStreamId = id;
        const payload = this.fieldValue(fields, 'payload');
        if (payload) this.applyRaw(payload);
      }
    }
  }

  private applyRaw(raw: string): void {
    const parsed = this.parse(raw);
    if (parsed) this.apply(parsed);
  }

  private clearStartupTimeout(): void {
    if (!this.startupTimeout) return;

    clearTimeout(this.startupTimeout);
    this.startupTimeout = null;
  }

  private fieldValue(fields: string[], key: string): string | null {
    for (let i = 0; i < fields.length; i += 2) {
      if (fields[i] === key) return fields[i + 1] ?? null;
    }
    return null;
  }
}
