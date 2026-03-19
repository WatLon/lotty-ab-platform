import { NotificationChannelType } from '@generated/prisma/client';
import { Injectable } from '@nestjs/common';
import {
  NotificationSender,
  NotificationSendInput,
  NotificationSendResult,
  readJsonString,
} from './notification-sender.interface';

@Injectable()
export class SlackSender implements NotificationSender {
  readonly type = NotificationChannelType.SLACK;
  async send(input: NotificationSendInput): Promise<NotificationSendResult> {
    const webhookUrl = input.targetAddress ?? readJsonString(input.channelConfig, 'webhookUrl');
    if (!webhookUrl) {
      return { ok: false, response: null, errorMessage: 'Slack webhook url is missing' };
    }
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: input.message }),
      });
      const body = await response.text();
      return response.ok
        ? { ok: true, response: { status: response.status, body }, errorMessage: null }
        : {
            ok: false,
            response: { status: response.status, body },
            errorMessage: `Slack request failed with status ${response.status}`,
          };
    } catch (error) {
      return {
        ok: false,
        response: null,
        errorMessage: error instanceof Error ? error.message : 'Slack request failed',
      };
    }
  }
}
