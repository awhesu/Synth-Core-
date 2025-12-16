import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PaymentIntentController } from './payment-intent.controller';
import { RefundIntentController } from './refund-intent.controller';
import { PaymentIntentService } from './payment-intent.service';
import { RefundIntentService } from './refund-intent.service';
import { PrismaService } from './prisma.service';

@Module({
  controllers: [
    HealthController,
    PaymentIntentController,
    RefundIntentController,
  ],
  providers: [
    PrismaService,
    PaymentIntentService,
    RefundIntentService,
  ],
})
export class AppModule {}
