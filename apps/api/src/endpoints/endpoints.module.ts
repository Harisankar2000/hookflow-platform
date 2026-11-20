import { Module } from '@nestjs/common';
import { ApplicationsModule } from '../applications/applications.module';
import { MessagesModule } from '../messages/messages.module';
import { EndpointsController } from './endpoints.controller';
import { EndpointsService } from './endpoints.service';

@Module({
  imports: [ApplicationsModule, MessagesModule],
  controllers: [EndpointsController],
  providers: [EndpointsService],
})
export class EndpointsModule {}
