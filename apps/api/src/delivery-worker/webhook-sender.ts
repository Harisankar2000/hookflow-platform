import { Inject, Injectable } from '@nestjs/common';
import { signPayload } from '../common/signature';
import { APP_CONFIG, AppConfig } from '../config/configuration';

const MAX_RESPONSE_BODY = 2048;

export interface SendInput {
  url: string;
  secret: string;
  messageId: string;
  eventType: string;
  payload: unknown;
  createdAt: Date;
}

export interface SendResult {
  ok: boolean;
  statusCode: number | null;
  durationMs: number;
  responseBody: string | null;
  error: string | null;
}

@Injectable()
export class WebhookSender {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  /** One signed POST. Never throws: failures come back as a result to log. */
  async send(input: SendInput, now = Date.now()): Promise<SendResult> {
    const timestamp = Math.floor(now / 1000);
    const body = JSON.stringify({
      id: input.messageId,
      type: input.eventType,
      timestamp: input.createdAt.toISOString(),
      data: input.payload,
    });
    const started = performance.now();

    try {
      const response = await fetch(input.url, {
        method: 'POST',
        redirect: 'manual',
        signal: AbortSignal.timeout(this.config.deliveryTimeoutMs),
        headers: {
          'content-type': 'application/json',
          'user-agent': 'HookFlow-Webhooks/0.1',
          'webhook-id': input.messageId,
          'webhook-timestamp': String(timestamp),
          'webhook-signature': signPayload(input.secret, input.messageId, timestamp, body),
        },
        body,
      });
      const text = await response.text().catch(() => '');
      return {
        ok: response.status >= 200 && response.status < 300,
        statusCode: response.status,
        durationMs: Math.round(performance.now() - started),
        responseBody: text.slice(0, MAX_RESPONSE_BODY) || null,
        error: response.ok ? null : `HTTP ${response.status}`,
      };
    } catch (err) {
      const error = err as Error & { cause?: { code?: string } };
      const reason =
        error.name === 'TimeoutError'
          ? `Timed out after ${this.config.deliveryTimeoutMs} ms`
          : (error.cause?.code ?? error.message);
      return {
        ok: false,
        statusCode: null,
        durationMs: Math.round(performance.now() - started),
        responseBody: null,
        error: reason,
      };
    }
  }
}
