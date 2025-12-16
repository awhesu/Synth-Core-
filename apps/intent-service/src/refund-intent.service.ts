/**
 * Refund Intent Service
 * 
 * CRITICAL: This service only creates/reads refund intents.
 * It does NOT write ledger entries.
 */

import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { RefundIntentStatus, RefundReason, PaymentIntentStatus, Prisma } from '@syntherium/db';
import { generateRefundReference } from '@syntherium/idempotency';
import { createLogger } from '@syntherium/observability';

const logger = createLogger('refund-intent-service');

export interface CreateRefundIntentDto {
  paymentIntentId: string;
  amount: string;
  reason: RefundReason;
  description?: string;
}

@Injectable()
export class RefundIntentService {
  constructor(private prisma: PrismaService) {}

  /**
   * Creates a new refund intent.
   */
  async create(dto: CreateRefundIntentDto) {
    const amount = new Prisma.Decimal(dto.amount);

    // Validate amount is positive
    if (amount.lessThanOrEqualTo(0)) {
      throw new BadRequestException({
        code: 'INVALID_AMOUNT',
        message: 'Refund amount must be greater than zero',
      });
    }

    // Get the original payment intent
    const paymentIntent = await this.prisma.paymentIntent.findUnique({
      where: { id: dto.paymentIntentId },
    });

    if (!paymentIntent) {
      throw new NotFoundException(`Payment intent not found: ${dto.paymentIntentId}`);
    }

    // Can only refund settled payments
    if (paymentIntent.status !== PaymentIntentStatus.SETTLED) {
      throw new BadRequestException({
        code: 'PAYMENT_NOT_SETTLED',
        message: 'Can only refund settled payments',
        details: { currentStatus: paymentIntent.status },
      });
    }

    // Calculate total refunded amount
    const existingRefunds = await this.prisma.refundIntent.findMany({
      where: {
        paymentIntentId: dto.paymentIntentId,
        status: { in: [RefundIntentStatus.PENDING, RefundIntentStatus.PROCESSING, RefundIntentStatus.SETTLED] },
      },
    });

    const totalRefunded = existingRefunds.reduce(
      (sum, r) => sum.add(r.amount),
      new Prisma.Decimal(0)
    );

    const remaining = paymentIntent.amount.sub(totalRefunded);

    if (amount.greaterThan(remaining)) {
      throw new BadRequestException({
        code: 'REFUND_EXCEEDS_REMAINING',
        message: 'Refund amount exceeds remaining refundable amount',
        details: {
          requestedAmount: amount.toString(),
          remainingAmount: remaining.toString(),
          originalAmount: paymentIntent.amount.toString(),
          totalRefunded: totalRefunded.toString(),
        },
      });
    }

    // Generate reference
    const sequence = existingRefunds.length + 1;
    const reference = generateRefundReference(dto.paymentIntentId, sequence);

    // Create refund intent
    const refundIntent = await this.prisma.refundIntent.create({
      data: {
        reference,
        paymentIntentId: dto.paymentIntentId,
        amount,
        reason: dto.reason,
        description: dto.description,
        status: RefundIntentStatus.PENDING,
      },
    });

    logger.info('Refund intent created', {
      id: refundIntent.id,
      reference,
      paymentIntentId: dto.paymentIntentId,
      amount: amount.toString(),
      reason: dto.reason,
    });

    return refundIntent;
  }

  /**
   * Retrieves a refund intent by ID.
   */
  async findById(id: string) {
    const refund = await this.prisma.refundIntent.findUnique({
      where: { id },
    });

    if (!refund) {
      throw new NotFoundException(`Refund intent not found: ${id}`);
    }

    return refund;
  }
}
