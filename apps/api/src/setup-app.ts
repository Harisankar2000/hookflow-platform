import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppConfig } from './config/configuration';

/** Shared by main.ts and the e2e tests so both run the same pipeline. */
export function setupApp(app: INestApplication, config: AppConfig) {
  app.use(helmet());
  app.enableCors({ origin: config.corsOrigin, credentials: false });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.enableShutdownHooks();

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('HookFlow API')
      .setDescription(
        'Webhook delivery platform: publish events once, HookFlow signs, delivers, retries and logs them.',
      )
      .setVersion('0.1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', description: 'Organization API key' })
      .build(),
  );
  SwaggerModule.setup('docs', app, document);
}
