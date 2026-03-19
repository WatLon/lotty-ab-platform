import { Module } from '@nestjs/common';
import { ControlEventsConsumer } from './control-events.consumer';
import { EventTypeProjection } from './event-type.projection';
import { FlagProjection } from './flag.projection';

@Module({
  providers: [FlagProjection, EventTypeProjection, ControlEventsConsumer],
})
export class ExperimentWorkersModule {}
