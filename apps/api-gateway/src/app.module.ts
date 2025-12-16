import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { HealthController } from './health.controller';
import { OpenApiController } from './openapi.controller';
import { RolesGuard } from '@syntherium/security';

@Module({
  controllers: [HealthController, OpenApiController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
