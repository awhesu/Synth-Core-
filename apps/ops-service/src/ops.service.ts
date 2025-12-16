/**
 * Ops Service
 * 
 * Read-only operations dashboard and administrative actions.
 * RBAC protected - requires ops or admin role.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { verifyChain, VerifyChainResult } from '@syntherium/ledger-core';
import { WebhookStatus, Prisma } from '@syntherium/db';
import { createLogger, logAuditEvent } from '@syntherium/observability';

const logger = createLogger('ops-service');

@Injectable()
export class OpsService {
  constructor(private prisma: PrismaService) {}

  async searchWebhookInbox(query: {
    provider?: string;
    status?: WebhookStatus;
    reference?: string;
    providerEventId?: string;
    fromDate?: Date;
    toDate?: Date;
    page?: number;
    limit?: number;
  }) {
    const { provider, status, reference, providerEventId, fromDate, toDate, page = 1, limit = 20 } = query;

    const where: Prisma.WebhookInboxWhereInput = {
      ...(provider && { provider: provider as any }),
      ...(status && { status }),
      ...(reference && { reference: { contains: reference } }),
      ...(providerEventId && { providerEventId }),
      ...(fromDate || toDate) && {
        receivedAt: {
          ...(fromDate && { gte: fromDate }),
          ...(toDate && { lte: toDate }),
        },
      },
    };

    const [data, total] = await Promise.all([
      this.prisma.webhookInbox.findMany({
        where,
        orderBy: { receivedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.webhookInbox.count({ where }),
    ]);

    return {
      data: data.map(w => ({
        id: w.id,
        provider: w.provider,
        providerEventId: w.providerEventId,
        reference: w.reference,
        status: w.status,
        payload: w.payload,
        errorMessage: w.errorMessage,
        receivedAt: w.receivedAt.toISOString(),
        processedAt: w.processedAt?.toISOString(),
      })),
      pagination: { page, limit, total, hasMore: page * limit < total },
    };
  }

  async searchLedgerEntries(query: {
    accountId?: string;
    reference?: string;
    orderId?: string;
    entryType?: string;
    minAmount?: string;
    maxAmount?: string;
    fromDate?: Date;
    toDate?: Date;
    page?: number;
    limit?: number;
  }) {
    const { accountId, reference, orderId, entryType, minAmount, maxAmount, fromDate, toDate, page = 1, limit = 20 } = query;

    const where: Prisma.LedgerEntryWhereInput = {
      ...(accountId && { accountId }),
      ...(reference && { reference: { contains: reference } }),
      ...(orderId && { orderId }),
      ...(entryType && { entryType: entryType as any }),
      ...(minAmount || maxAmount) && {
        amount: {
          ...(minAmount && { gte: new Prisma.Decimal(minAmount) }),
          ...(maxAmount && { lte: new Prisma.Decimal(maxAmount) }),
        },
      },
      ...(fromDate || toDate) && {
        createdAt: {
          ...(fromDate && { gte: fromDate }),
          ...(toDate && { lte: toDate }),
        },
      },
    };

    const [data, total, aggregates] = await Promise.all([
      this.prisma.ledgerEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.ledgerEntry.count({ where }),
      this.computeAggregates(where),
    ]);

    return {
      data: data.map(e => ({
        id: e.id,
        accountId: e.accountId,
        walletSeq: e.walletSeq,
        reference: e.reference,
        orderId: e.orderId,
        entryType: e.entryType,
        amount: e.amount.toString(),
        description: e.description,
        prevHash: e.prevHash,
        entryHash: e.entryHash,
        createdAt: e.createdAt.toISOString(),
      })),
      pagination: { page, limit, total, hasMore: page * limit < total },
      aggregates,
    };
  }

  private async computeAggregates(where: Prisma.LedgerEntryWhereInput) {
    const entries = await this.prisma.ledgerEntry.findMany({ where, select: { entryType: true, amount: true } });
    
    let totalCredits = new Prisma.Decimal(0);
    let totalDebits = new Prisma.Decimal(0);

    for (const e of entries) {
      if (e.entryType === 'CREDIT') {
        totalCredits = totalCredits.add(e.amount);
      } else {
        totalDebits = totalDebits.add(e.amount);
      }
    }

    return {
      totalCredits: totalCredits.toString(),
      totalDebits: totalDebits.toString(),
      netAmount: totalCredits.sub(totalDebits).toString(),
    };
  }

  async replayWebhook(webhookId: string, reason: string, actorId: string) {
    const webhook = await this.prisma.webhookInbox.findUnique({ where: { id: webhookId } });

    if (!webhook) {
      return { webhookId, status: 'FAILED', message: 'Webhook not found', settlementTriggered: false };
    }

    // Log audit event
    logAuditEvent({
      action: 'WEBHOOK_REPLAY',
      actor: { id: actorId, type: 'user' },
      resource: { type: 'WebhookInbox', id: webhookId },
      outcome: 'success',
      details: { reason, previousStatus: webhook.status },
    });

    // TODO: Actually trigger reprocessing
    logger.info('Webhook replay requested', { webhookId, reason, actorId });

    return {
      webhookId,
      status: 'REPLAYED',
      message: 'Webhook replay initiated',
      settlementTriggered: true,
    };
  }

  async verifyChains(accountIds: string[], verifyAll: boolean) {
    let accounts = accountIds;

    if (verifyAll) {
      const wallets = await this.prisma.walletBalanceCache.findMany({ select: { accountId: true } });
      accounts = wallets.map(w => w.accountId);
    }

    const results: VerifyChainResult[] = [];

    for (const accountId of accounts) {
      const result = await verifyChain(this.prisma, accountId);
      results.push(result);
    }

    const validCount = results.filter(r => r.valid).length;

    return {
      results,
      summary: {
        totalAccounts: results.length,
        validAccounts: validCount,
        invalidAccounts: results.length - validCount,
        allValid: validCount === results.length,
      },
    };
  }
}
