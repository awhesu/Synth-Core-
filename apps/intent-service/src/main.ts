/**
 * Intent Service - Main Entry Point
 * 
 * Handles payment and refund intent creation and retrieval.
 * CRITICAL: This service does NOT write ledger entries.
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createLogger } from '@syntherium/observability';

const logger = createLogger('intent-service');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('v1');

  const port = process.env.PORT || 3001;
  await app.listen(port);
  
  logger.info(`Intent Service started`, { port });
}

bootstrap().catch((error) => {
  logger.error('Failed to start Intent Service', error);
  process.exit(1);
});
