import { afterEach, describe, expect, it } from 'vitest';
import { SlackSender } from '@/apps/control-workers/notification/slack.sender';
import { TelegramSender } from '@/apps/control-workers/notification/telegram.sender';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});
describe('Notification senders', () => {
  it('Slack sender fails fast when webhook is missing', async () => {
    const sender = new SlackSender();
    const result = await sender.send({
      channelConfig: {},
      targetAddress: null,
      message: 'hello',
    });
    expect(result.ok).toBe(false);
    expect(result.errorMessage).toContain('missing');
  });
  it('Slack sender posts message and returns response payload', async () => {
    const sender = new SlackSender();
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      expect(url).toBe('https://hooks.slack.test/abc');
      expect(init?.method).toBe('POST');
      expect(typeof init?.body).toBe('string');
      return {
        ok: true,
        status: 200,
        text: async () => 'ok',
      } as Response;
    }) as typeof fetch;
    const result = await sender.send({
      channelConfig: { webhookUrl: 'https://hooks.slack.test/abc' },
      targetAddress: null,
      message: 'hello',
    });
    expect(result.ok).toBe(true);
    expect(result.errorMessage).toBeNull();
    expect(result.response).toEqual({ status: 200, body: 'ok' });
  });
  it('Telegram sender fails fast when token or chat id is missing', async () => {
    const sender = new TelegramSender();
    const missingToken = await sender.send({
      channelConfig: { chatId: '123' },
      targetAddress: null,
      message: 'hello',
    });
    const missingChat = await sender.send({
      channelConfig: { botToken: 'secret' },
      targetAddress: null,
      message: 'hello',
    });
    expect(missingToken.ok).toBe(false);
    expect(missingToken.errorMessage).toContain('token');
    expect(missingChat.ok).toBe(false);
    expect(missingChat.errorMessage).toContain('chat');
  });
  it('Telegram sender posts message and returns response payload', async () => {
    const sender = new TelegramSender();
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      expect(url).toBe('https://api.telegram.org/botbot-token/sendMessage');
      expect(init?.method).toBe('POST');
      expect(typeof init?.body).toBe('string');
      return {
        ok: true,
        status: 200,
        text: async () => '{"ok":true}',
      } as Response;
    }) as typeof fetch;
    const result = await sender.send({
      channelConfig: { botToken: 'bot-token', chatId: '42' },
      targetAddress: null,
      message: 'hello',
    });
    expect(result.ok).toBe(true);
    expect(result.errorMessage).toBeNull();
    expect(result.response).toEqual({ status: 200, body: '{"ok":true}' });
  });
});
