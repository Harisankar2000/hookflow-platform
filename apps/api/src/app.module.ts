import { Module } from '@nestjs/common';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { ApplicationsModule } from './applications/applications.module';
import { loadConfig } from './config/configuration';
import { CoreModule } from './core.module';
import { DeliveriesModule } from './deliveries/deliveries.module';
import { DeliveryWorkerModule } from './delivery-worker/delivery-worker.module';
import { EndpointsModule } from './endpoints/endpoints.module';
import { EventTypesModule } from './event-types/event-types.module';
import { HealthModule } from './health/health.module';
import { AppLoggerModule } from './logger.module';
import { MessagesModule } from './messages/messages.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { RealtimeModule } from './realtime/realtime.module';
import { StatsModule } from './stats/stats.module';

@Module({
  imports: [
    AppLoggerModule,
    CoreModule,
    OrganizationsModule,
    ApiKeysModule,
    ApplicationsModule,
    EventTypesModule,
    EndpointsModule,
    MessagesModule,
    DeliveriesModule,
    StatsModule,
    RealtimeModule,
    HealthModule,
    ...(loadConfig().runWorkerInApi ? [DeliveryWorkerModule] : []),
  ],
})
export class AppModule {}
