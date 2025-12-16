import { Controller, Post, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { Request } from 'express';
import { WebhookService } from './webhook.service';
import { PaymentProvider } from '@syntherium/db';
import { createLogger } from '@syntherium/observability';

const logger = createLogger('flutterwave-webhook');

@Controller('webhooks')
export class FlutterwaveWebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post('flutterwave')
  @HttpCode(HttpStatus.OK)
  async handleFlutterwaveWebhook(@Req() req: Request) {
    const payload = req.body;
    const headers = req.headers as Record<string, string>;
    
    // Extract provider event ID and reference from Flutterwave payload
    const providerEventId = payload.id?.toString() || 
                           payload.data?.id?.toString() || 
                           `flw_${Date.now()}`;
    
    const reference = payload.data?.tx_ref || 
                     payload.tx_ref || 
                     payload.data?.reference;

    logger.info('Received Flutterwave webhook', {
      providerEventId,
      reference,
      event: payload.event,
    });

    const result = await this.webhookService.processWebhook({
      provider: PaymentProvider.flutterwave,
      providerEventId,
      reference,
      payload,
      headers,
      rawBody: JSON.stringify(payload), // In production, use raw body middleware
    });

    return {
      status: 'received',
      webhookId: result.id,
      processed: result.status === 'PROCESSED',
    };
  }
}
