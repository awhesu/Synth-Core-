/**
 * Ledger Query Service
 * 
 * Read-only queries for ledger entries and wallet balances.
 * This service does NOT write entries.
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { verifyChain, VerifyChainResult } from '@syntherium/ledger-core';
import { LedgerEntryType, Prisma } from '@syntherium/db';

export interface LedgerEntryQuery {
  accountId?: string;
  reference?: string;
  orderId?: string;
  entryType?: LedgerEntryType;
  fromDate?: Date;
  toDate?: Date;
  page?: number;
  limit?: number;
}

@Injectable()
export class LedgerQueryService {
  constructor(private prisma: PrismaService) {}

  /**
   * Queries ledger entries with filtering and pagination.
   */
  async getEntries(query: LedgerEntryQuery) {
    const { accountId, reference, orderId, entryType, fromDate, toDate, page = 1, limit = 20 } = query;

    const where: Prisma.LedgerEntryWhereInput = {
      ...(accountId && { accountId }),
      ...(reference && { reference: { contains: reference } }),
      ...(orderId && { orderId }),
      ...(entryType && { entryType }),
      ...(fromDate || toDate) && {
        createdAt: {
          ...(fromDate && { gte: fromDate }),
          ...(toDate && { lte: toDate }),
        },
      },
    };

    const [entries, total] = await Promise.all([
      this.prisma.ledgerEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.ledgerEntry.count({ where }),
    ]);

    return {
      data: entries.map(this.formatEntry),
      pagination: {
        page,
        limit,
        total,
        hasMore: page * limit < total,
      },
    };
  }

  /**
   * Gets wallet balance from cache.
   */
  async getWalletBalance(accountId: string) {
    const balance = await this.prisma.walletBalanceCache.findUnique({
      where: { accountId },
    });

    if (!balance) {
      throw new NotFoundException(`Wallet not found: ${accountId}`);
    }

    return {
      accountId: balance.accountId,
      balance: balance.balance.toString(),
      currency: balance.currency,
      lastEntrySeq: balance.lastEntrySeq,
      lastUpdatedAt: balance.lastUpdatedAt.toISOString(),
    };
  }

  /**
   * Verifies ledger chain integrity.
   */
  async verifyChainIntegrity(accountId: string, fromSeq?: number, toSeq?: number): Promise<VerifyChainResult> {
    return verifyChain(this.prisma, accountId, fromSeq, toSeq);
  }

  private formatEntry(entry: any) {
    return {
      id: entry.id,
      accountId: entry.accountId,
      walletSeq: entry.walletSeq,
      reference: entry.reference,
      orderId: entry.orderId,
      entryType: entry.entryType,
      amount: entry.amount.toString(),
      description: entry.description,
      prevHash: entry.prevHash,
      entryHash: entry.entryHash,
      createdAt: entry.createdAt.toISOString(),
    };
  }
}
