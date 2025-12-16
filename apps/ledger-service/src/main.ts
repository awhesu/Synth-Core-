/**
 * Ledger Service - Main Entry Point
 * 
 * Read-only ledger query service.
 * CRITICAL: This service does NOT write ledger entries.
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createLogger } from '@syntherium/observability';

const logger = createLogger('ledger-service');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('v1');

  const port = process.env.PORT || 3004;
  await app.listen(port);
  
  logger.info(`Ledger Service started`, { port });
}

bootstrap().catch((error) => {
  logger.error('Failed to start Ledger Service', error);
  process.exit(1);
});
