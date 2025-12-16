/**
 * Webhook Service - Main Entry Point
 * 
 * Receives and processes webhooks from payment providers.
 * CRITICAL: This service does NOT write ledger entries.
 * It stores, verifies, dedupes, and triggers settlement.
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createLogger } from '@syntherium/observability';

const logger = createLogger('webhook-service');

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Enable raw body parsing for signature verification
    rawBody: true,
  });
  app.setGlobalPrefix('v1');

  const port = process.env.PORT || 3002;
  await app.listen(port);
  
  logger.info(`Webhook Service started`, { port });
}

bootstrap().catch((error) => {
  logger.error('Failed to start Webhook Service', error);
  process.exit(1);
});
