import { LoggerModule } from 'nestjs-pino';
import { loadConfig } from './config/configuration';

const config = loadConfig();

export const AppLoggerModule = LoggerModule.forRoot({
  pinoHttp: {
    level: config.logLevel,
    redact: ['req.headers.authorization', 'req.headers["x-admin-token"]'],
    autoLogging: { ignore: (req) => req.url === '/health' },
    transport:
      process.env.NODE_ENV === 'production'
        ? undefined
        : { target: 'pino-pretty', options: { singleLine: true } },
  },
});
