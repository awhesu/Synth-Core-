/**
 * Payment Intent Service
 * 
 * CRITICAL: This service only creates/reads intents.
 * It does NOT write ledger entries.
 */

import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { PaymentProvider, PaymentIntentStatus, Prisma } from '@syntherium/db';
import { generatePaymentReference } from '@syntherium/idempotency';
import { createLogger } from '@syntherium/observability';

const logger = createLogger('payment-intent-service');

export interface CreatePaymentIntentDto {
  orderId: string;
  amount: string;
  originalAmount: string;
  discountCode?: string;
  provider: PaymentProvider;
  currency?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class PaymentIntentService {
  constructor(private prisma: PrismaService) {}

  /**
   * Creates a new payment intent.
   * 
   * Invariants enforced:
   * - originalAmount >= amount
   * - discountAmount = originalAmount - amount
   * - If discountAmount > 0, discountCode is required
   */
  async create(dto: CreatePaymentIntentDto) {
    const amount = new Prisma.Decimal(dto.amount);
    const originalAmount = new Prisma.Decimal(dto.originalAmount);
    const discountAmount = originalAmount.sub(amount);

    // Validate invariants
    this.validateInvariants(amount, originalAmount, discountAmount, dto.discountCode);

    // Generate deterministic reference
    const reference = generatePaymentReference(dto.orderId);

    // Check for existing intent (idempotency)
    const existing = await this.prisma.paymentIntent.findUnique({
      where: { reference },
    });

    if (existing) {
      logger.info('Returning existing payment intent (idempotent)', {
        reference,
        orderId: dto.orderId,
      });
      return existing;
    }

    // Create new intent
    const intent = await this.prisma.paymentIntent.create({
      data: {
        reference,
        orderId: dto.orderId,
        amount,
        originalAmount,
        discountAmount,
        discountCode: dto.discountCode,
        provider: dto.provider,
        currency: dto.currency || 'NGN',
        status: PaymentIntentStatus.PENDING,
        metadata: dto.metadata as Prisma.JsonObject,
      },
    });

    logger.info('Payment intent created', {
      id: intent.id,
      reference,
      orderId: dto.orderId,
      amount: amount.toString(),
      discountAmount: discountAmount.toString(),
    });

    return intent;
  }

  /**
   * Retrieves a payment intent by ID.
   */
  async findById(id: string) {
    const intent = await this.prisma.paymentIntent.findUnique({
      where: { id },
    });

    if (!intent) {
      throw new NotFoundException(`Payment intent not found: ${id}`);
    }

    return intent;
  }

  /**
   * Retrieves a payment intent by reference.
   */
  async findByReference(reference: string) {
    const intent = await this.prisma.paymentIntent.findUnique({
      where: { reference },
    });

    if (!intent) {
      throw new NotFoundException(`Payment intent not found for reference: ${reference}`);
    }

    return intent;
  }

  /**
   * Retrieves a payment intent by order ID.
   */
  async findByOrderId(orderId: string) {
    const reference = generatePaymentReference(orderId);
    return this.findByReference(reference);
  }

  /**
   * Validates payment intent invariants.
   * 
   * @throws BadRequestException if invariants are violated
   */
  private validateInvariants(
    amount: Prisma.Decimal,
    originalAmount: Prisma.Decimal,
    discountAmount: Prisma.Decimal,
    discountCode?: string
  ): void {
    // Check: originalAmount >= amount
    if (originalAmount.lessThan(amount)) {
      throw new BadRequestException({
        code: 'INVALID_AMOUNTS',
        message: 'originalAmount must be greater than or equal to amount',
        details: {
          amount: amount.toString(),
          originalAmount: originalAmount.toString(),
        },
      });
    }

    // Check: amounts must be positive
    if (amount.lessThanOrEqualTo(0)) {
      throw new BadRequestException({
        code: 'INVALID_AMOUNT',
        message: 'amount must be greater than zero',
        details: { amount: amount.toString() },
      });
    }

    // Check: if discountAmount > 0, discountCode is required
    if (discountAmount.greaterThan(0) && !discountCode) {
      throw new BadRequestException({
        code: 'DISCOUNT_CODE_REQUIRED',
        message: 'discountCode is required when discountAmount > 0',
        details: {
          discountAmount: discountAmount.toString(),
          discountCode: null,
        },
      });
    }

    // Check: discountAmount cannot be negative
    if (discountAmount.lessThan(0)) {
      throw new BadRequestException({
        code: 'INVALID_DISCOUNT',
        message: 'discountAmount cannot be negative (amount cannot exceed originalAmount)',
        details: {
          amount: amount.toString(),
          originalAmount: originalAmount.toString(),
          discountAmount: discountAmount.toString(),
        },
      });
    }
  }
}
