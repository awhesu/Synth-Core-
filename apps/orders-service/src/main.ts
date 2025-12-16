import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createLogger } from '@syntherium/observability';

const logger = createLogger('orders-service');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('v1');

  const port = process.env.PORT || 3005;
  await app.listen(port);
  
  logger.info(`Orders Service started`, { port });
}

bootstrap().catch((error) => {
  logger.error('Failed to start Orders Service', error);
  process.exit(1);
});
