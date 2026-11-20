export const LIVE_CHANNEL = 'hookflow:live';

export type LiveEventType = 'message.created' | 'delivery.updated';

export interface LiveEvent {
  organizationId: string;
  type: LiveEventType;
  data: Record<string, unknown>;
}
