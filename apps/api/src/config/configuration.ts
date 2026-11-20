import { existsSync } from 'node:fs';

// Local development reads apps/api/.env; containers pass real environment variables.
if (existsSync('.env')) process.loadEnvFile('.env');

export interface AppConfig {
  port: number;
  databaseUrl: string;
  redisUrl: string;
  adminToken: string;
  corsOrigin: string[];
  deliveryTimeoutMs: number;
  deliveryConcurrency: number;
  retryScheduleMs: number[];
  runWorkerInApi: boolean;
  logLevel: string;
}

function list(value: string | undefined, fallback: string): string[] {
  return (value ?? fallback)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const retryScheduleMs = list(env.RETRY_SCHEDULE_MS, '5000,30000,120000,600000,1800000').map(
    Number,
  );
  if (retryScheduleMs.some((ms) => !Number.isFinite(ms) || ms < 0)) {
    throw new Error('RETRY_SCHEDULE_MS must be a comma-separated list of non-negative numbers');
  }
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required');

  return {
    port: Number(env.PORT ?? 3200),
    databaseUrl: env.DATABASE_URL,
    redisUrl: env.REDIS_URL ?? 'redis://localhost:6390',
    adminToken: env.ADMIN_TOKEN ?? '',
    corsOrigin: list(env.CORS_ORIGIN, 'http://localhost:5180'),
    deliveryTimeoutMs: Number(env.DELIVERY_TIMEOUT_MS ?? 10_000),
    deliveryConcurrency: Number(env.DELIVERY_CONCURRENCY ?? 10),
    retryScheduleMs,
    runWorkerInApi: (env.RUN_WORKER_IN_API ?? 'true') === 'true',
    logLevel: env.LOG_LEVEL ?? 'info',
  };
}

export const APP_CONFIG = Symbol('APP_CONFIG');
