import { Request } from 'express';

export interface AuthedRequest extends Request {
  organizationId: string;
  apiKeyId: string;
}
