/**
 * Webhook Service
 * 
 * CRITICAL: This service NEVER writes ledger entries.
 * It only:
 * 1. Stores webhooks in WebhookInbox
 * 2. Deduplicates by provider + providerEventId
 * 3. Verifies signatures
 * 4. Triggers settlement (calls settlement-service)
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { PaymentProvider, WebhookStatus, Prisma } from '@syntherium/db';
import { verifyFlutterwaveSignature } from '@syntherium/security';
import { createLogger } from '@syntherium/observability';

const logger = createLogger('webhook-service');

export interface WebhookPayload {
  provider: PaymentProvider;
  providerEventId: string;
  reference?: string;
  payload: Record<string, unknown>;
  headers: Record<string, string>;
  rawBody: string;
}

export interface WebhookResult {
  id: string;
  status: WebhookStatus;
  isDuplicate: boolean;
  message: string;
}

@Injectable()
export class WebhookService {
  constructor(private prisma: PrismaService) {}

  /**
   * Processes an incoming webhook.
   */
  async processWebhook(payload: WebhookPayload): Promise<WebhookResult> {
    const { provider, providerEventId, reference, headers, rawBody } = payload;

    // Step 1: Check for existing (dedupe)
    const existing = await this.prisma.webhookInbox.findUnique({
      where: {
        provider_providerEventId: {
          provider,
          providerEventId,
        },
      },
    });

    if (existing) {
      logger.info('Duplicate webhook detected', {
        provider,
        providerEventId,
        existingId: existing.id,
      });

      if (existing.status !== WebhookStatus.DUPLICATE) {
        await this.prisma.webhookInbox.update({
          where: { id: existing.id },
          data: { status: WebhookStatus.DUPLICATE },
        });
      }

      return {
        id: existing.id,
        status: WebhookStatus.DUPLICATE,
        isDuplicate: true,
        message: 'Webhook already processed',
      };
    }

    // Step 2: Store webhook
    const webhook = await this.prisma.webhookInbox.create({
      data: {
        provider,
        providerEventId,
        reference,
        payload: payload.payload as Prisma.JsonObject,
        headers: headers as Prisma.JsonObject,
        status: WebhookStatus.RECEIVED,
      },
    });

    logger.info('Webhook stored', { id: webhook.id, provider, providerEventId });

    // Step 3: Verify signature
    const isValid = await this.verifySignature(provider, rawBody, headers);

    if (!isValid) {
      await this.prisma.webhookInbox.update({
        where: { id: webhook.id },
        data: {
          status: WebhookStatus.FAILED,
          errorMessage: 'Signature verification failed',
          processedAt: new Date(),
        },
      });

      return {
        id: webhook.id,
        status: WebhookStatus.FAILED,
        isDuplicate: false,
        message: 'Signature verification failed',
      };
    }

    // Step 4: Mark as verified
    await this.prisma.webhookInbox.update({
      where: { id: webhook.id },
      data: { status: WebhookStatus.VERIFIED, processedAt: new Date() },
    });

    // Step 5: Trigger settlement
    await this.triggerSettlement(reference, webhook.id);

    await this.prisma.webhookInbox.update({
      where: { id: webhook.id },
      data: { status: WebhookStatus.PROCESSED },
    });

    return {
      id: webhook.id,
      status: WebhookStatus.PROCESSED,
      isDuplicate: false,
      message: 'Webhook processed successfully',
    };
  }

  private async verifySignature(
    provider: PaymentProvider,
    rawBody: string,
    headers: Record<string, string>
  ): Promise<boolean> {
    switch (provider) {
      case PaymentProvider.flutterwave:
        const signature = headers['verif-hash'] || headers['x-flw-signature'] || '';
        const secretHash = process.env.FLUTTERWAVE_SECRET_HASH || '';
        return verifyFlutterwaveSignature(rawBody, signature, secretHash);
      default:
        // TODO: Implement other providers
        return process.env.NODE_ENV === 'development';
    }
  }

  private async triggerSettlement(reference: string | undefined, webhookId: string): Promise<void> {
    if (!reference) {
      logger.warn('No reference found, cannot trigger settlement', { webhookId });
      return;
    }
    // TODO: Call settlement-service
    logger.info('Settlement trigger stub', { reference, webhookId });
  }

  async replayWebhook(webhookId: string): Promise<WebhookResult> {
    const webhook = await this.prisma.webhookInbox.findUnique({
      where: { id: webhookId },
    });

    if (!webhook) {
      return {
        id: webhookId,
        status: WebhookStatus.FAILED,
        isDuplicate: false,
        message: 'Webhook not found',
      };
    }

    if (webhook.status === WebhookStatus.PROCESSED) {
      return {
        id: webhookId,
        status: WebhookStatus.PROCESSED,
        isDuplicate: false,
        message: 'Webhook already processed',
      };
    }

    await this.triggerSettlement(webhook.reference ?? undefined, webhookId);
    await this.prisma.webhookInbox.update({
      where: { id: webhookId },
      data: { status: WebhookStatus.PROCESSED, processedAt: new Date() },
    });

    return {
      id: webhookId,
      status: WebhookStatus.PROCESSED,
      isDuplicate: false,
      message: 'Webhook replayed successfully',
    };
  }
}
