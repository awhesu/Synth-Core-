import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createLogger } from '@syntherium/observability';

const logger = createLogger('ops-service');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('v1');

  const port = process.env.PORT || 3006;
  await app.listen(port);
  
  logger.info(`Ops Service started`, { port });
}

bootstrap().catch((error) => {
  logger.error('Failed to start Ops Service', error);
  process.exit(1);
});
