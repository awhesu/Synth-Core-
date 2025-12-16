/**
 * Settlement Service - Main Entry Point
 * 
 * CRITICAL: This is the ONLY service that writes ledger entries.
 * All financial truth flows through this service.
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createLogger } from '@syntherium/observability';

const logger = createLogger('settlement-service');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('v1');

  const port = process.env.PORT || 3003;
  await app.listen(port);
  
  logger.info(`Settlement Service started`, { port });
  logger.warn('CRITICAL: This service is the ONLY writer of ledger entries');
}

bootstrap().catch((error) => {
  logger.error('Failed to start Settlement Service', error);
  process.exit(1);
});
