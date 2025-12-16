/**
 * @syntherium/idempotency
 * 
 * Idempotency helpers for ensuring exactly-once semantics.
 */

import * as crypto from 'crypto';

/**
 * Generates a deterministic idempotency key from input values.
 * Used to ensure the same operation is not processed twice.
 */
export function generateIdempotencyKey(...parts: (string | number)[]): string {
  const combined = parts.map(String).join('|');
  return crypto.createHash('sha256').update(combined).digest('hex').substring(0, 32);
}

/**
 * Generates a payment intent reference.
 * Format: PAYMENT_{orderId}
 */
export function generatePaymentReference(orderId: string): string {
  return `PAYMENT_${orderId}`;
}

/**
 * Generates a refund intent reference.
 * Format: REFUND_{paymentIntentId}_{sequence}
 */
export function generateRefundReference(paymentIntentId: string, sequence: number): string {
  return `REFUND_${paymentIntentId}_${sequence}`;
}

/**
 * Generates a ledger entry reference for discount subsidy.
 * Format: {paymentReference}_DISC
 */
export function generateDiscountReference(paymentReference: string): string {
  return `${paymentReference}_DISC`;
}

/**
 * Extracts order ID from a payment reference.
 */
export function extractOrderIdFromPaymentRef(reference: string): string | null {
  const match = reference.match(/^PAYMENT_(.+)$/);
  return match ? match[1] : null;
}

/**
 * Validates reference format.
 */
export function isValidReference(reference: string): boolean {
  // References should be alphanumeric with underscores
  return /^[A-Z0-9_]+$/.test(reference);
}

/**
 * Idempotent operation wrapper.
 * Checks if operation was already performed before executing.
 */
export interface IdempotentResult<T> {
  executed: boolean;
  result: T;
  cached: boolean;
}

/**
 * Creates an idempotent operation context.
 * 
 * @example
 * const ctx = createIdempotentContext();
 * const result = await ctx.executeOnce('key', async () => {
 *   return await performOperation();
 * });
 */
export function createIdempotentContext() {
  const cache = new Map<string, unknown>();

  return {
    async executeOnce<T>(
      key: string,
      operation: () => Promise<T>
    ): Promise<IdempotentResult<T>> {
      if (cache.has(key)) {
        return {
          executed: false,
          result: cache.get(key) as T,
          cached: true,
        };
      }

      const result = await operation();
      cache.set(key, result);

      return {
        executed: true,
        result,
        cached: false,
      };
    },

    has(key: string): boolean {
      return cache.has(key);
    },

    clear(): void {
      cache.clear();
    },
  };
}
