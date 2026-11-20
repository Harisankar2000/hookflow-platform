import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface OverviewRow {
  total: bigint;
  succeeded: bigint;
  failed: bigint;
  in_flight: bigint;
}

interface DailyRow {
  day: Date;
  succeeded: bigint;
  failed: bigint;
}

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Last-24h totals and latency percentiles for the dashboard cards. */
  async overview(orgId: string) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [counts] = await this.prisma.$queryRaw<OverviewRow[]>(Prisma.sql`
      SELECT count(*)                                              AS total,
             count(*) FILTER (WHERE d.status = 'SUCCEEDED')        AS succeeded,
             count(*) FILTER (WHERE d.status = 'FAILED')           AS failed,
             count(*) FILTER (WHERE d.status IN ('PENDING', 'RETRYING')) AS in_flight
      FROM "Delivery" d
      JOIN "Endpoint" e ON e.id = d."endpointId"
      JOIN "Application" a ON a.id = e."applicationId"
      WHERE a."organizationId" = ${orgId} AND d."createdAt" >= ${since}`);

    const [latency] = await this.prisma.$queryRaw<{ p50: number | null; p95: number | null }[]>(
      Prisma.sql`
      SELECT percentile_cont(0.5)  WITHIN GROUP (ORDER BY t."durationMs") AS p50,
             percentile_cont(0.95) WITHIN GROUP (ORDER BY t."durationMs") AS p95
      FROM "DeliveryAttempt" t
      JOIN "Delivery" d ON d.id = t."deliveryId"
      JOIN "Endpoint" e ON e.id = d."endpointId"
      JOIN "Application" a ON a.id = e."applicationId"
      WHERE a."organizationId" = ${orgId} AND t."createdAt" >= ${since} AND t."statusCode" IS NOT NULL`,
    );

    const [activeEndpoints, applications] = await Promise.all([
      this.prisma.endpoint.count({
        where: { disabled: false, application: { organizationId: orgId } },
      }),
      this.prisma.application.count({ where: { organizationId: orgId } }),
    ]);

    const total = Number(counts.total);
    const succeeded = Number(counts.succeeded);
    const failed = Number(counts.failed);
    const finished = succeeded + failed;
    return {
      window: '24h',
      total,
      succeeded,
      failed,
      inFlight: Number(counts.in_flight),
      successRate: finished ? Math.round((succeeded / finished) * 1000) / 10 : null,
      latencyP50Ms: latency.p50 === null ? null : Math.round(latency.p50),
      latencyP95Ms: latency.p95 === null ? null : Math.round(latency.p95),
      activeEndpoints,
      applications,
    };
  }

  /** Daily succeeded and failed deliveries for the last `days` days (UTC), zero-filled. */
  async daily(orgId: string, days: number) {
    const rows = await this.prisma.$queryRaw<DailyRow[]>(Prisma.sql`
      SELECT g.day::date AS day,
             count(d.id) FILTER (WHERE d.status = 'SUCCEEDED') AS succeeded,
             count(d.id) FILTER (WHERE d.status = 'FAILED')    AS failed
      FROM generate_series(
             date_trunc('day', now() AT TIME ZONE 'UTC') - make_interval(days => ${days - 1}::int),
             date_trunc('day', now() AT TIME ZONE 'UTC'),
             interval '1 day') AS g(day)
      LEFT JOIN "Delivery" d
             ON date_trunc('day', d."createdAt") = g.day
            AND d."endpointId" IN (
                  SELECT e.id FROM "Endpoint" e
                  JOIN "Application" a ON a.id = e."applicationId"
                  WHERE a."organizationId" = ${orgId})
      GROUP BY g.day
      ORDER BY g.day`);
    return rows.map((r) => ({
      date: r.day.toISOString().slice(0, 10),
      succeeded: Number(r.succeeded),
      failed: Number(r.failed),
    }));
  }
}
