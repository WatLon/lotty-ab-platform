import { Global, Module } from '@nestjs/common';
import { DistributedLockService } from './distributed-lock.service';
import { RedisClientProvider } from './redis-client.provider';

@Global()
@Module({
  providers: [RedisClientProvider, DistributedLockService],
  exports: [RedisClientProvider, DistributedLockService],
})
export class CacheModule {}
