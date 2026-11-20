import { Inject, Injectable, Logger } from '@nestjs/common';
import { DeliveryStatus, Prisma } from '@prisma/client';
import { APP_CONFIG, AppConfig } from '../config/configuration';
import { PrismaService } from '../prisma/prisma.service';
import { LiveEventsPublisher } from '../realtime/live-events.publisher';
import { maxAttempts, nextRetryDelay } from './backoff';
import { DeliverJobData } from './delivery.constants';
import { DeliveryQueueService } from './delivery-queue.service';
import { WebhookSender } from './webhook-sender';

export type AttemptOutcome = 'succeeded' | 'retrying' | 'failed' | 'skipped';

@Injectable()
export class DeliveryAttemptService {
  private readonly logger = new Logger(DeliveryAttemptService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sender: WebhookSender,
    private readonly queue: DeliveryQueueService,
    private readonly live: LiveEventsPublisher,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Performs one attempt of one delivery and decides what happens next. */
  async run({ deliveryId, attempt }: DeliverJobData): Promise<AttemptOutcome> {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: {
        endpoint: true,
        message: { include: { application: { select: { organizationId: true } } } },
      },
    });

    // Deleted, already finished, or a stale/duplicate job for an attempt that already ran.
    if (
      !delivery ||
      delivery.status === DeliveryStatus.SUCCEEDED ||
      delivery.status === DeliveryStatus.FAILED ||
      delivery.attemptCount !== attempt - 1
    ) {
      return 'skipped';
    }

    const organizationId = delivery.message.application.organizationId;
    const result = delivery.endpoint.disabled
      ? {
          ok: false,
          statusCode: null,
          durationMs: 0,
          responseBody: null,
          error: 'Endpoint is disabled',
        }
      : await this.sender.send({
          url: delivery.endpoint.url,
          secret: delivery.endpoint.secret,
          messageId: delivery.messageId,
          eventType: delivery.message.eventType,
          payload: delivery.message.payload,
          createdAt: delivery.message.createdAt,
        });

    const retryDelay =
      result.ok || delivery.endpoint.disabled || attempt >= maxAttempts(this.config.retryScheduleMs)
        ? null
        : nextRetryDelay(this.config.retryScheduleMs, attempt);
    const status = result.ok
      ? DeliveryStatus.SUCCEEDED
      : retryDelay === null
        ? DeliveryStatus.FAILED
        : DeliveryStatus.RETRYING;

    try {
      await this.prisma.$transaction([
        this.prisma.deliveryAttempt.create({
          data: {
            deliveryId,
            attempt,
            statusCode: result.statusCode,
            durationMs: result.durationMs,
            responseBody: result.responseBody,
            error: result.error,
          },
        }),
        this.prisma.delivery.update({
          where: { id: deliveryId },
          data: {
            status,
            attemptCount: attempt,
            lastStatusCode: result.statusCode,
            lastError: result.error,
            latencyMs: result.durationMs,
            nextAttemptAt: retryDelay === null ? null : new Date(Date.now() + retryDelay),
          },
        }),
      ]);
    } catch (err) {
      // Another worker recorded this attempt first (unique deliveryId + attempt).
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return 'skipped';
      }
      throw err;
    }

    if (retryDelay !== null) await this.queue.enqueue(deliveryId, attempt + 1, retryDelay);

    this.live.publish({
      organizationId,
      type: 'delivery.updated',
      data: {
        id: deliveryId,
        messageId: delivery.messageId,
        endpointId: delivery.endpointId,
        status,
        attempt,
        statusCode: result.statusCode,
        latencyMs: result.durationMs,
      },
    });

    this.logger.log(
      `delivery=${deliveryId} attempt=${attempt} status=${status} code=${result.statusCode ?? '-'} ${result.durationMs}ms`,
    );
    return status === DeliveryStatus.SUCCEEDED
      ? 'succeeded'
      : status === DeliveryStatus.RETRYING
        ? 'retrying'
        : 'failed';
  }
}
