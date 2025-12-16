import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { FlutterwaveWebhookController } from './flutterwave-webhook.controller';
import { WebhookService } from './webhook.service';
import { PrismaService } from './prisma.service';

@Module({
  controllers: [HealthController, FlutterwaveWebhookController],
  providers: [PrismaService, WebhookService],
})
export class AppModule {}
