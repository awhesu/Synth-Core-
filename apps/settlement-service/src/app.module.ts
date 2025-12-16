import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { SettlementService } from './settlement.service';
import { PrismaService } from './prisma.service';

@Module({
  controllers: [HealthController],
  providers: [PrismaService, SettlementService],
  exports: [SettlementService],
})
export class AppModule {}
