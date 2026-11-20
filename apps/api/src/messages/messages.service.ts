import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ApplicationsService } from '../applications/applications.service';
import { cursorArgs, toPage } from '../common/pagination';
import { DeliveryQueueService } from '../delivery-worker/delivery-queue.service';
import { PrismaService } from '../prisma/prisma.service';
import { LiveEventsPublisher } from '../realtime/live-events.publisher';
import { CreateMessageDto, ListMessagesQuery } from './messages.dto';

/** Max payload stored and delivered, measured as JSON. */
const MAX_PAYLOAD_BYTES = 256 * 1024;

export class PayloadTooLargeError extends Error {}

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly applications: ApplicationsService,
    private readonly queue: DeliveryQueueService,
    private readonly live: LiveEventsPublisher,
  ) {}

  /**
   * Stores a message and one delivery per subscribed endpoint in a single transaction,
   * then queues the deliveries. With an idempotency key, a repeat call returns the
   * original message instead of sending it again.
   */
  async publish(orgId: string, appIdOrUid: string, dto: CreateMessageDto) {
    const app = await this.applications.resolve(orgId, appIdOrUid);
    if (Buffer.byteLength(JSON.stringify(dto.payload)) > MAX_PAYLOAD_BYTES) {
      throw new PayloadTooLargeError(`payload is larger than ${MAX_PAYLOAD_BYTES} bytes`);
    }

    if (dto.idempotencyKey) {
      const existing = await this.findByIdempotencyKey(app.id, dto.idempotencyKey);
      if (existing) return { message: existing, duplicate: true };
    }

    let message;
    try {
      message = await this.prisma.$transaction(async (tx) => {
        const endpoints = await tx.endpoint.findMany({
          where: {
            applicationId: app.id,
            disabled: false,
            OR: [{ filterTypes: { isEmpty: true } }, { filterTypes: { has: dto.eventType } }],
          },
          select: { id: true },
        });
        return tx.message.create({
          data: {
            applicationId: app.id,
            eventType: dto.eventType,
            payload: dto.payload as Prisma.InputJsonValue,
            idempotencyKey: dto.idempotencyKey,
            deliveries: { create: endpoints.map((e) => ({ endpointId: e.id })) },
          },
          include: { deliveries: { select: { id: true, endpointId: true, status: true } } },
        });
      });
    } catch (err) {
      // Two concurrent requests with the same key: the loser returns the winner's message.
      if (
        dto.idempotencyKey &&
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const existing = await this.findByIdempotencyKey(app.id, dto.idempotencyKey);
        if (existing) return { message: existing, duplicate: true };
      }
      throw err;
    }

    await this.dispatch(orgId, message.id, message.deliveries.map((d) => d.id));
    return { message, duplicate: false };
  }

  /** Sends a test event to one endpoint, ignoring its filter. */
  async sendTest(orgId: string, endpointId: string) {
    const endpoint = await this.prisma.endpoint.findFirst({
      where: { id: endpointId, application: { organizationId: orgId } },
    });
    if (!endpoint) throw new NotFoundException('Endpoint not found');

    const message = await this.prisma.message.create({
      data: {
        applicationId: endpoint.applicationId,
        eventType: 'hookflow.test',
        payload: { message: 'Test event from HookFlow', sentAt: new Date().toISOString() },
        deliveries: { create: [{ endpointId: endpoint.id }] },
      },
      include: { deliveries: { select: { id: true, endpointId: true, status: true } } },
    });
    await this.dispatch(orgId, message.id, message.deliveries.map((d) => d.id));
    return message;
  }

  async list(orgId: string, query: ListMessagesQuery) {
    const appFilter = query.applicationId
      ? { id: (await this.applications.resolve(orgId, query.applicationId)).id }
      : {};
    const rows = await this.prisma.message.findMany({
      where: {
        application: { organizationId: orgId, ...appFilter },
        ...(query.eventType ? { eventType: query.eventType } : {}),
      },
      include: {
        application: { select: { name: true, uid: true } },
        deliveries: { select: { status: true } },
      },
      ...cursorArgs(query),
    });
    return toPage(rows, query.limit ?? 25);
  }

  async get(orgId: string, id: string) {
    const message = await this.prisma.message.findFirst({
      where: { id, application: { organizationId: orgId } },
      include: {
        application: { select: { name: true, uid: true } },
        deliveries: {
          include: { endpoint: { select: { id: true, url: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!message) throw new NotFoundException('Message not found');
    return message;
  }

  private findByIdempotencyKey(applicationId: string, idempotencyKey: string) {
    return this.prisma.message.findUnique({
      where: { applicationId_idempotencyKey: { applicationId, idempotencyKey } },
      include: { deliveries: { select: { id: true, endpointId: true, status: true } } },
    });
  }

  private async dispatch(orgId: string, messageId: string, deliveryIds: string[]) {
    try {
      await this.queue.enqueueMany(deliveryIds);
    } catch (err) {
      // The rows are committed as PENDING; the worker's sweeper re-queues them.
      this.logger.error(`Queueing deliveries for message ${messageId} failed`, err as Error);
    }
    this.live.publish({
      organizationId: orgId,
      type: 'message.created',
      data: { messageId, deliveries: deliveryIds.length },
    });
  }
}
