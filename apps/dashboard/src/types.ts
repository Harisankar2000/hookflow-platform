export type DeliveryStatus = 'PENDING' | 'SUCCEEDED' | 'RETRYING' | 'FAILED';

export interface Page<T> {
  data: T[];
  nextCursor: string | null;
}

export interface Organization {
  id: string;
  name: string;
  createdAt: string;
}

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  key?: string;
}

export interface Application {
  id: string;
  name: string;
  uid: string;
  createdAt: string;
  endpointCount: number;
  messageCount: number;
}

export interface EventType {
  id: string;
  name: string;
  description: string | null;
  schemaExample: unknown;
  archived: boolean;
  createdAt: string;
}

export interface Endpoint {
  id: string;
  applicationId: string;
  url: string;
  description: string | null;
  filterTypes: string[];
  disabled: boolean;
  createdAt: string;
  application: { name: string; uid: string };
  last24h?: { succeeded: number; failed: number; inFlight: number };
  secret?: string;
}

export interface Message {
  id: string;
  applicationId: string;
  eventType: string;
  payload: unknown;
  idempotencyKey: string | null;
  createdAt: string;
  application: { name: string; uid: string };
  deliveries: { status: DeliveryStatus }[];
}

export interface DeliveryAttempt {
  id: string;
  attempt: number;
  statusCode: number | null;
  durationMs: number;
  responseBody: string | null;
  error: string | null;
  createdAt: string;
}

export interface Delivery {
  id: string;
  messageId: string;
  endpointId: string;
  status: DeliveryStatus;
  attemptCount: number;
  nextAttemptAt: string | null;
  lastStatusCode: number | null;
  lastError: string | null;
  latencyMs: number | null;
  createdAt: string;
  updatedAt: string;
  endpoint: { id: string; url: string; description?: string | null };
  message: {
    id: string;
    eventType: string;
    payload?: unknown;
    application: { name: string; uid: string };
  };
  attempts?: DeliveryAttempt[];
}

export interface Stats {
  total: number;
  succeeded: number;
  failed: number;
  inFlight: number;
  successRate: number | null;
  latencyP50Ms: number | null;
  latencyP95Ms: number | null;
  activeEndpoints: number;
  applications: number;
}

export interface DailyPoint {
  date: string;
  succeeded: number;
  failed: number;
}
