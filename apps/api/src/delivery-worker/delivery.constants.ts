export const DELIVERY_QUEUE = 'deliveries';
export const DELIVER_JOB = 'deliver';

export interface DeliverJobData {
  deliveryId: string;
  /** 1-based attempt this job performs. Lets the worker drop stale or duplicate jobs. */
  attempt: number;
}

/** One job per (delivery, attempt): adding the same attempt twice is a no-op in BullMQ. */
export const deliverJobId = (deliveryId: string, attempt: number) => `${deliveryId}-${attempt}`;
