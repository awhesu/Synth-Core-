/**
 * API Gateway - Main Entry Point
 * 
 * Serves as the unified entry point for all Syntherium APIs.
 * Handles routing, authentication, and OpenAPI documentation.
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createLogger } from '@syntherium/observability';

const logger = createLogger('api-gateway');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Global prefix for all routes
  app.setGlobalPrefix('v1');
  
  // CORS configuration
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') || '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  logger.info(`API Gateway started`, { port });
  logger.info(`OpenAPI spec available at http://localhost:${port}/openapi`);
  logger.info(`Health check at http://localhost:${port}/health`);
}

bootstrap().catch((error) => {
  logger.error('Failed to start API Gateway', error);
  process.exit(1);
});
