/**
 * Payment Intent Service Tests
 * 
 * Tests for invariant enforcement
 */

import { PaymentIntentService } from './payment-intent.service';
import { BadRequestException } from '@nestjs/common';

describe('PaymentIntentService Invariants', () => {
  // Mock Prisma service
  const mockPrisma = {
    paymentIntent: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  let service: PaymentIntentService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PaymentIntentService(mockPrisma as any);
  });

  describe('create', () => {
    it('should reject when amount > originalAmount', async () => {
      mockPrisma.paymentIntent.findUnique.mockResolvedValue(null);

      await expect(
        service.create({
          orderId: 'test-order',
          amount: '15000.0000',
          originalAmount: '10000.0000', // Less than amount!
          provider: 'flutterwave' as any,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when discountAmount > 0 without discountCode', async () => {
      mockPrisma.paymentIntent.findUnique.mockResolvedValue(null);

      await expect(
        service.create({
          orderId: 'test-order',
          amount: '8000.0000',
          originalAmount: '10000.0000', // Discount of 2000
          // No discountCode provided!
          provider: 'flutterwave' as any,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept valid intent with discount', async () => {
      mockPrisma.paymentIntent.findUnique.mockResolvedValue(null);
      mockPrisma.paymentIntent.create.mockResolvedValue({
        id: 'pi_123',
        reference: 'PAYMENT_test-order',
        orderId: 'test-order',
        amount: { toString: () => '8000.0000' },
        originalAmount: { toString: () => '10000.0000' },
        discountAmount: { toString: () => '2000.0000' },
        discountCode: 'PROMO2024',
        provider: 'flutterwave',
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.create({
        orderId: 'test-order',
        amount: '8000.0000',
        originalAmount: '10000.0000',
        discountCode: 'PROMO2024',
        provider: 'flutterwave' as any,
      });

      expect(result.id).toBe('pi_123');
      expect(mockPrisma.paymentIntent.create).toHaveBeenCalled();
    });

    it('should accept valid intent without discount', async () => {
      mockPrisma.paymentIntent.findUnique.mockResolvedValue(null);
      mockPrisma.paymentIntent.create.mockResolvedValue({
        id: 'pi_124',
        reference: 'PAYMENT_test-order-2',
        orderId: 'test-order-2',
        amount: { toString: () => '10000.0000' },
        originalAmount: { toString: () => '10000.0000' },
        discountAmount: { toString: () => '0.0000' },
        discountCode: null,
        provider: 'flutterwave',
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.create({
        orderId: 'test-order-2',
        amount: '10000.0000',
        originalAmount: '10000.0000',
        // No discount
        provider: 'flutterwave' as any,
      });

      expect(result.id).toBe('pi_124');
    });

    it('should reject zero amount', async () => {
      mockPrisma.paymentIntent.findUnique.mockResolvedValue(null);

      await expect(
        service.create({
          orderId: 'test-order',
          amount: '0.0000',
          originalAmount: '0.0000',
          provider: 'flutterwave' as any,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should return existing intent for idempotent calls', async () => {
      const existingIntent = {
        id: 'pi_existing',
        reference: 'PAYMENT_test-order',
        orderId: 'test-order',
      };
      mockPrisma.paymentIntent.findUnique.mockResolvedValue(existingIntent);

      const result = await service.create({
        orderId: 'test-order',
        amount: '10000.0000',
        originalAmount: '10000.0000',
        provider: 'flutterwave' as any,
      });

      expect(result.id).toBe('pi_existing');
      expect(mockPrisma.paymentIntent.create).not.toHaveBeenCalled();
    });
  });
});
