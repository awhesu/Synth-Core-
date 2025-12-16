/**
 * Webhook Service Tests
 * 
 * Tests for deduplication
 */

import { WebhookService } from './webhook.service';
import { PaymentProvider, WebhookStatus } from '@syntherium/db';

describe('WebhookService', () => {
  const mockPrisma = {
    webhookInbox: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  let service: WebhookService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WebhookService(mockPrisma as any);
  });

  describe('processWebhook', () => {
    it('should detect and reject duplicate webhooks', async () => {
      const existingWebhook = {
        id: 'wh_existing',
        provider: PaymentProvider.flutterwave,
        providerEventId: 'flw_123',
        status: WebhookStatus.PROCESSED,
      };

      mockPrisma.webhookInbox.findUnique.mockResolvedValue(existingWebhook);

      const result = await service.processWebhook({
        provider: PaymentProvider.flutterwave,
        providerEventId: 'flw_123',
        reference: 'PAYMENT_order_abc',
        payload: { test: true },
        headers: {},
        rawBody: '{}',
      });

      expect(result.isDuplicate).toBe(true);
      expect(result.status).toBe(WebhookStatus.DUPLICATE);
      expect(mockPrisma.webhookInbox.create).not.toHaveBeenCalled();
    });

    it('should store new webhooks', async () => {
      mockPrisma.webhookInbox.findUnique.mockResolvedValue(null);
      mockPrisma.webhookInbox.create.mockResolvedValue({
        id: 'wh_new',
        provider: PaymentProvider.flutterwave,
        providerEventId: 'flw_456',
        status: WebhookStatus.RECEIVED,
      });
      mockPrisma.webhookInbox.update.mockResolvedValue({
        id: 'wh_new',
        status: WebhookStatus.PROCESSED,
      });

      const result = await service.processWebhook({
        provider: PaymentProvider.flutterwave,
        providerEventId: 'flw_456',
        reference: 'PAYMENT_order_xyz',
        payload: { test: true },
        headers: {},
        rawBody: '{}',
      });

      expect(result.isDuplicate).toBe(false);
      expect(mockPrisma.webhookInbox.create).toHaveBeenCalled();
    });
  });
});
