/**
 * Settlement Service
 * 
 * ██████╗ ██████╗ ██╗████████╗██╗ ██████╗ █████╗ ██╗     
 * ██╔════╝██╔══██╗██║╚══██╔══╝██║██╔════╝██╔══██╗██║     
 * ██║     ██████╔╝██║   ██║   ██║██║     ███████║██║     
 * ██║     ██╔══██╗██║   ██║   ██║██║     ██╔══██║██║     
 * ╚██████╗██║  ██║██║   ██║   ██║╚██████╗██║  ██║███████╗
 *  ╚═════╝╚═╝  ╚═╝╚═╝   ╚═╝   ╚═╝ ╚═════╝╚═╝  ╚═╝╚══════╝
 * 
 * THIS IS THE ONLY SERVICE THAT WRITES LEDGER ENTRIES.
 * 
 * Financial Truth Rules:
 * 1. Ledger is append-only - entries are NEVER updated or deleted
 * 2. All writes happen in a single atomic transaction
 * 3. Wallet balance cache is updated in the SAME transaction
 * 4. Discounts are subsidies: Marketing pays Vendor via Escrow
 * 5. Refunds create NEW entries, never mutate old ones
 */

import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { 
  PaymentIntentStatus, 
  LedgerEntryType,
  Prisma 
} from '@syntherium/db';
import { appendEntry, AppendEntryResult } from '@syntherium/ledger-core';
import { createLogger, logAuditEvent } from '@syntherium/observability';

const logger = createLogger('settlement-service');

// System wallet identifiers
const PLATFORM_ESCROW = 'PLATFORM_ESCROW';
const MARKETING_WALLET = 'MARKETING_WALLET';

export interface SettlementResult {
  success: boolean;
  paymentIntentId: string;
  reference: string;
  ledgerEntries: AppendEntryResult[];
  message: string;
}

@Injectable()
export class SettlementService {
  constructor(private prisma: PrismaService) {}

  /**
   * Settles a payment intent by creating ledger entries.
   * 
   * This is the ONLY method that writes to the ledger.
   * 
   * @param intentId - Payment intent ID to settle
   * @returns Settlement result with created ledger entries
   */
  async settlePayment(intentId: string): Promise<SettlementResult> {
    logger.info('Starting payment settlement', { intentId });

    // Use a transaction to ensure atomicity
    const result = await this.prisma.$transaction(async (tx) => {
      // Step 1: Lock and fetch the payment intent
      const intent = await tx.paymentIntent.findUnique({
        where: { id: intentId },
      });

      if (!intent) {
        throw new BadRequestException({
          code: 'INTENT_NOT_FOUND',
          message: `Payment intent not found: ${intentId}`,
        });
      }

      // Step 2: Check if already settled (idempotency)
      if (intent.status === PaymentIntentStatus.SETTLED) {
        logger.info('Payment already settled (idempotent)', {
          intentId,
          reference: intent.reference,
        });

        // Return existing entries for idempotency
        const existingEntries = await tx.ledgerEntry.findMany({
          where: { reference: { startsWith: intent.reference } },
        });

        return {
          success: true,
          paymentIntentId: intentId,
          reference: intent.reference,
          ledgerEntries: existingEntries.map(e => ({
            id: e.id,
            accountId: e.accountId,
            walletSeq: e.walletSeq,
            reference: e.reference,
            entryType: e.entryType,
            amount: e.amount,
            entryHash: e.entryHash,
            prevHash: e.prevHash,
          })),
          message: 'Payment already settled',
        };
      }

      // Step 3: Validate status allows settlement
      if (intent.status !== PaymentIntentStatus.CONFIRMING) {
        throw new BadRequestException({
          code: 'INVALID_STATUS_FOR_SETTLEMENT',
          message: `Cannot settle payment in status: ${intent.status}`,
          details: { currentStatus: intent.status, requiredStatus: 'CONFIRMING' },
        });
      }

      const ledgerEntries: AppendEntryResult[] = [];

      // Step 4: Create primary ledger entry - Credit to Platform Escrow
      const primaryEntry = await appendEntry(tx, {
        reference: intent.reference,
        orderId: intent.orderId,
        accountId: PLATFORM_ESCROW,
        entryType: LedgerEntryType.CREDIT,
        amount: intent.amount,
        description: `Payment received for order ${intent.orderId}`,
      });
      ledgerEntries.push(primaryEntry);

      logger.info('Primary ledger entry created', {
        entryId: primaryEntry.id,
        accountId: PLATFORM_ESCROW,
        amount: intent.amount.toString(),
        reference: intent.reference,
      });

      // Step 5: Handle discount subsidy if applicable
      if (intent.discountAmount.greaterThan(0)) {
        const discountReference = `${intent.reference}_DISC`;

        // Debit Marketing Wallet for subsidy
        const marketingDebit = await appendEntry(tx, {
          reference: discountReference,
          orderId: intent.orderId,
          accountId: MARKETING_WALLET,
          entryType: LedgerEntryType.DEBIT,
          amount: intent.discountAmount,
          description: `Discount subsidy for order ${intent.orderId} (${intent.discountCode})`,
        });
        ledgerEntries.push(marketingDebit);

        logger.info('Marketing debit entry created', {
          entryId: marketingDebit.id,
          accountId: MARKETING_WALLET,
          amount: intent.discountAmount.toString(),
          discountCode: intent.discountCode,
        });

        // Credit Platform Escrow with subsidy (vendor receives full amount)
        const subsidyCredit = await appendEntry(tx, {
          reference: `${discountReference}_ESCROW`,
          orderId: intent.orderId,
          accountId: PLATFORM_ESCROW,
          entryType: LedgerEntryType.CREDIT,
          amount: intent.discountAmount,
          description: `Discount subsidy credit for order ${intent.orderId}`,
        });
        ledgerEntries.push(subsidyCredit);

        logger.info('Subsidy credit entry created', {
          entryId: subsidyCredit.id,
          accountId: PLATFORM_ESCROW,
          amount: intent.discountAmount.toString(),
        });
      }

      // Step 6: Update payment intent status to SETTLED
      await tx.paymentIntent.update({
        where: { id: intentId },
        data: { status: PaymentIntentStatus.SETTLED },
      });

      return {
        success: true,
        paymentIntentId: intentId,
        reference: intent.reference,
        ledgerEntries,
        message: 'Payment settled successfully',
      };
    }, {
      // Transaction options for strong consistency
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 10000, // 10 second timeout
    });

    // Log audit event outside transaction
    logAuditEvent({
      action: 'PAYMENT_SETTLED',
      actor: { id: 'settlement-service', type: 'service' },
      resource: { type: 'PaymentIntent', id: intentId },
      outcome: 'success',
      details: {
        reference: result.reference,
        entriesCreated: result.ledgerEntries.length,
      },
    });

    logger.info('Payment settlement completed', {
      intentId,
      reference: result.reference,
      entriesCreated: result.ledgerEntries.length,
    });

    return result;
  }

  /**
   * Settles a payment by reference.
   */
  async settlePaymentByReference(reference: string): Promise<SettlementResult> {
    const intent = await this.prisma.paymentIntent.findUnique({
      where: { reference },
    });

    if (!intent) {
      throw new BadRequestException({
        code: 'INTENT_NOT_FOUND',
        message: `Payment intent not found for reference: ${reference}`,
      });
    }

    return this.settlePayment(intent.id);
  }
}
