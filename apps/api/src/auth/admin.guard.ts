import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { safeEqual } from '../common/crypto';
import { APP_CONFIG, AppConfig } from '../config/configuration';

/** Protects organization creation. Disabled entirely when ADMIN_TOKEN is empty. */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const token = context.switchToHttp().getRequest<Request>().header('x-admin-token') ?? '';
    if (!this.config.adminToken || !safeEqual(token, this.config.adminToken)) {
      throw new UnauthorizedException('Invalid admin token');
    }
    return true;
  }
}
