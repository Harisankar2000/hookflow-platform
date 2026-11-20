import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DeliveryStatus, Prisma } from '@prisma/client';
import { ApplicationsService } from '../applications/applications.service';
import { cursorArgs, toPage } from '../common/pagination';
import { DeliveryQueueService } from '../delivery-worker/delivery-queue.service';
import { PrismaService } from '../prisma/prisma.service';
import { ListDeliveriesQuery, ReplayFailedDto } from './deliveries.dto';

const BULK_REPLAY_LIMIT = 1000;

@Injectable()
export class DeliveriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly applications: ApplicationsService,
    private readonly queue: DeliveryQueueService,
  ) {}

  async list(orgId: string, query: ListDeliveriesQuery) {
    const appId = query.applicationId
      ? (await this.applications.resolve(orgId, query.applicationId)).id
      : undefined;
    const where: Prisma.DeliveryWhereInput = {
      endpoint: { application: { organizationId: orgId, ...(appId ? { id: appId } : {}) } },
      ...(query.status ? { status: query.status } : {}),
      ...(query.endpointId ? { endpointId: query.endpointId } : {}),
      ...(query.messageId ? { messageId: query.messageId } : {}),
      ...(query.eventType ? { message: { eventType: query.eventType } } : {}),
    };
    const rows = await this.prisma.delivery.findMany({
      where,
      include: {
        endpoint: { select: { id: true, url: true } },
        message: {
          select: { id: true, eventType: true, application: { select: { name: true, uid: true } } },
        },
      },
      ...cursorArgs(query),
    });
    return toPage(rows, query.limit ?? 25);
  }

  async get(orgId: string, id: string) {
    const delivery = await this.prisma.delivery.findFirst({
      where: { id, endpoint: { application: { organizationId: orgId } } },
      include: {
        endpoint: { select: { id: true, url: true, description: true } },
        message: { include: { application: { select: { name: true, uid: true } } } },
        attempts: { orderBy: { attempt: 'desc' } },
      },
    });
    if (!delivery) throw new NotFoundException('Delivery not found');
    return delivery;
  }

  /**
   * Sends a finished delivery once more. A manual replay is a single attempt:
   * it is logged like any other, and the automatic retry budget is not reset.
   */
  async replay(orgId: string, id: string) {
    const delivery = await this.get(orgId, id);
    if (delivery.status !== DeliveryStatus.FAILED && delivery.status !== DeliveryStatus.SUCCEEDED) {
      throw new BadRequestException('Only finished deliveries can be replayed');
    }
    // Conditional update: two clicks on Replay queue one attempt, not two.
    const claimed = await this.prisma.delivery.updateMany({
      where: { id, status: delivery.status, attemptCount: delivery.attemptCount },
      data: { status: DeliveryStatus.PENDING, nextAttemptAt: null },
    });
    if (claimed.count === 1) await this.queue.enqueue(id, delivery.attemptCount + 1);
    return { replayed: claimed.count === 1, attempt: delivery.attemptCount + 1 };
  }

  /** Replays failed deliveries in bulk, up to 1000 per call. */
  async replayFailed(orgId: string, dto: ReplayFailedDto) {
    const appId = dto.applicationId
      ? (await this.applications.resolve(orgId, dto.applicationId)).id
      : undefined;
    const failed = await this.prisma.delivery.findMany({
      where: {
        status: DeliveryStatus.FAILED,
        endpoint: {
          disabled: false,
          application: { organizationId: orgId, ...(appId ? { id: appId } : {}) },
          ...(dto.endpointId ? { id: dto.endpointId } : {}),
        },
      },
      select: { id: true, attemptCount: true },
      orderBy: { createdAt: 'asc' },
      take: BULK_REPLAY_LIMIT,
    });

    let replayed = 0;
    for (const d of failed) {
      const claimed = await this.prisma.delivery.updateMany({
        where: { id: d.id, status: DeliveryStatus.FAILED, attemptCount: d.attemptCount },
        data: { status: DeliveryStatus.PENDING, nextAttemptAt: null },
      });
      if (claimed.count === 1) {
        await this.queue.enqueue(d.id, d.attemptCount + 1);
        replayed++;
      }
    }
    return { replayed };
  }
}
