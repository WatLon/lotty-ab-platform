import { NotificationChannelType } from '@generated/prisma/enums';
import { Injectable } from '@nestjs/common';
import {
  NotificationSender,
  NotificationSendInput,
  NotificationSendResult,
  readJsonString,
} from './notification-sender.interface';

@Injectable()
export class TelegramSender implements NotificationSender {
  readonly type = NotificationChannelType.TELEGRAM;
  async send(input: NotificationSendInput): Promise<NotificationSendResult> {
    const botToken = readJsonString(input.channelConfig, 'botToken');
    const chatId = input.targetAddress ?? readJsonString(input.channelConfig, 'chatId');
    if (!botToken) {
      return { ok: false, response: null, errorMessage: 'Telegram bot token is missing' };
    }
    if (!chatId) {
      return { ok: false, response: null, errorMessage: 'Telegram chat id is missing' };
    }
    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: input.message,
          disable_web_page_preview: true,
        }),
      });
      const body = await response.text();
      return response.ok
        ? { ok: true, response: { status: response.status, body }, errorMessage: null }
        : {
            ok: false,
            response: { status: response.status, body },
            errorMessage: `Telegram request failed with status ${response.status}`,
          };
    } catch (error) {
      return {
        ok: false,
        response: null,
        errorMessage: error instanceof Error ? error.message : 'Telegram request failed',
      };
    }
  }
}
