import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApplicationDto, UpdateApplicationDto } from './applications.dto';

function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  return slug.length >= 2 ? slug : `app-${slug}`;
}

@Injectable()
export class ApplicationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Finds an application by id or uid, only inside the caller's organization. */
  async resolve(orgId: string, idOrUid: string) {
    const app = await this.prisma.application.findFirst({
      where: { organizationId: orgId, OR: [{ id: idOrUid }, { uid: idOrUid }] },
    });
    if (!app) throw new NotFoundException('Application not found');
    return app;
  }

  async list(orgId: string) {
    const apps = await this.prisma.application.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { endpoints: true, messages: true } } },
    });
    return apps.map(({ _count, ...app }) => ({
      ...app,
      endpointCount: _count.endpoints,
      messageCount: _count.messages,
    }));
  }

  async create(orgId: string, dto: CreateApplicationDto) {
    try {
      return await this.prisma.application.create({
        data: { organizationId: orgId, name: dto.name, uid: dto.uid ?? slugify(dto.name) },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('An application with this uid already exists');
      }
      throw err;
    }
  }

  async update(orgId: string, idOrUid: string, dto: UpdateApplicationDto) {
    const app = await this.resolve(orgId, idOrUid);
    return this.prisma.application.update({ where: { id: app.id }, data: { name: dto.name } });
  }

  async remove(orgId: string, idOrUid: string) {
    const app = await this.resolve(orgId, idOrUid);
    await this.prisma.application.delete({ where: { id: app.id } });
    return { deleted: true };
  }
}
