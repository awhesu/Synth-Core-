import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { HealthController } from './health.controller';
import { OpsController } from './ops.controller';
import { OpsService } from './ops.service';
import { PrismaService } from './prisma.service';
import { RolesGuard } from '@syntherium/security';

@Module({
  controllers: [HealthController, OpsController],
  providers: [
    PrismaService,
    OpsService,
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
