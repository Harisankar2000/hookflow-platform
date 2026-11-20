import { Injectable, NotFoundException } from '@nestjs/common';
import { ApplicationsService } from '../applications/applications.service';
import { generateEndpointSecret } from '../common/crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEndpointDto, UpdateEndpointDto } from './endpoints.dto';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Everything about an endpoint except its signing secret. */
const publicSelect = {
  id: true,
  applicationId: true,
  url: true,
  description: true,
  filterTypes: true,
  disabled: true,
  consecutiveFailures: true,
  createdAt: true,
  updatedAt: true,
  application: { select: { name: true, uid: true } },
};

@Injectable()
export class EndpointsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly applications: ApplicationsService,
  ) {}

  async find(orgId: string, id: string) {
    const endpoint = await this.prisma.endpoint.findFirst({
      where: { id, application: { organizationId: orgId } },
      select: publicSelect,
    });
    if (!endpoint) throw new NotFoundException('Endpoint not found');
    return endpoint;
  }

  /** Endpoints with their last-24h delivery counts, for the endpoints table. */
  async list(orgId: string, applicationId?: string) {
    const appFilter = applicationId
      ? { id: (await this.applications.resolve(orgId, applicationId)).id }
      : {};
    const endpoints = await this.prisma.endpoint.findMany({
      where: { application: { organizationId: orgId, ...appFilter } },
      select: publicSelect,
      orderBy: { createdAt: 'desc' },
    });

    const counts = await this.prisma.delivery.groupBy({
      by: ['endpointId', 'status'],
      where: {
        endpointId: { in: endpoints.map((e) => e.id) },
        createdAt: { gte: new Date(Date.now() - DAY_MS) },
      },
      _count: { _all: true },
    });

    return endpoints.map((endpoint) => {
      const mine = counts.filter((c) => c.endpointId === endpoint.id);
      const count = (status: string) =>
        mine.find((c) => c.status === status)?._count._all ?? 0;
      return {
        ...endpoint,
        last24h: {
          succeeded: count('SUCCEEDED'),
          failed: count('FAILED'),
          inFlight: count('PENDING') + count('RETRYING'),
        },
      };
    });
  }

  async create(orgId: string, dto: CreateEndpointDto) {
    const app = await this.applications.resolve(orgId, dto.applicationId);
    const created = await this.prisma.endpoint.create({
      data: {
        applicationId: app.id,
        url: dto.url,
        description: dto.description,
        filterTypes: dto.filterTypes ?? [],
        secret: generateEndpointSecret(),
      },
      select: { ...publicSelect, secret: true },
    });
    return created;
  }

  async update(orgId: string, id: string, dto: UpdateEndpointDto) {
    await this.find(orgId, id);
    return this.prisma.endpoint.update({
      where: { id },
      data: {
        ...dto,
        // Re-enabling an endpoint gives it a clean failure streak.
        ...(dto.disabled === false ? { consecutiveFailures: 0 } : {}),
      },
      select: publicSelect,
    });
  }

  async remove(orgId: string, id: string) {
    await this.find(orgId, id);
    await this.prisma.endpoint.delete({ where: { id } });
    return { deleted: true };
  }

  async getSecret(orgId: string, id: string) {
    await this.find(orgId, id);
    const { secret } = await this.prisma.endpoint.findUniqueOrThrow({
      where: { id },
      select: { secret: true },
    });
    return { secret };
  }

  async rotateSecret(orgId: string, id: string) {
    await this.find(orgId, id);
    const { secret } = await this.prisma.endpoint.update({
      where: { id },
      data: { secret: generateEndpointSecret() },
      select: { secret: true },
    });
    return { secret };
  }
}
