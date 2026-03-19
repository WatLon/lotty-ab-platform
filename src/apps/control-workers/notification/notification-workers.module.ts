import { Module } from '@nestjs/common';
import { NotificationConsumer } from './notification.consumer';
import { NotificationDispatcher } from './notification.dispatcher';
import { NotificationRenderer } from './notification.renderer';
import { SlackSender } from './slack.sender';
import { TelegramSender } from './telegram.sender';

@Module({
  providers: [
    NotificationConsumer,
    NotificationDispatcher,
    NotificationRenderer,
    SlackSender,
    TelegramSender,
  ],
})
export class NotificationWorkersModule {}
