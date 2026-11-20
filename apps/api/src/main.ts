import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { loadConfig } from './config/configuration';
import { setupApp } from './setup-app';

async function bootstrap() {
  const config = loadConfig();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  setupApp(app, config);
  await app.listen(config.port);
  app.get(Logger).log(`HookFlow API on http://localhost:${config.port} (docs at /docs)`);
}

void bootstrap();
