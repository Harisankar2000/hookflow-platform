import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ApiKeyService } from './api-key.service';
import { AuthedRequest } from './auth.types';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeys: ApiKeyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('Missing Bearer API key');

    const identity = await this.apiKeys.authenticate(token);
    if (!identity) throw new UnauthorizedException('Invalid or revoked API key');

    req.organizationId = identity.organizationId;
    req.apiKeyId = identity.apiKeyId;
    return true;
  }
}
