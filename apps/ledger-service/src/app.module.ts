import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { LedgerController } from './ledger.controller';
import { LedgerQueryService } from './ledger-query.service';
import { PrismaService } from './prisma.service';

@Module({
  controllers: [HealthController, LedgerController],
  providers: [PrismaService, LedgerQueryService],
})
export class AppModule {}
