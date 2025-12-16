/**
 * @syntherium/db
 * 
 * Database library exporting Prisma client and types
 */

export { PrismaClient } from './generated/prisma';
export * from './generated/prisma';

// Re-export commonly used types for convenience
export type {
  Order,
  OrderItem,
  PaymentIntent,
  RefundIntent,
  WebhookInbox,
  LedgerEntry,
  WalletBalanceCache,
} from './generated/prisma';

export {
  OrderStatus,
  DeliveryType,
  PaymentProvider,
  PaymentIntentStatus,
  RefundIntentStatus,
  RefundReason,
  WebhookStatus,
  LedgerEntryType,
} from './generated/prisma';
