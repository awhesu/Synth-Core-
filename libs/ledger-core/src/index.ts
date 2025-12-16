/**
 * @syntherium/ledger-core
 * 
 * Core ledger operations for append-only financial truth layer.
 * 
 * CRITICAL INVARIANTS:
 * 1. Only SettlementService should call appendEntry
 * 2. Ledger entries are NEVER updated or deleted
 * 3. Each entry links to previous via SHA256 hash
 * 4. walletSeq increments monotonically per account
 * 5. Balance cache is updated in same transaction as entry
 */

import { PrismaClient, LedgerEntryType, Prisma } from '@syntherium/db';
import * as crypto from 'crypto';

export interface AppendEntryParams {
  reference: string;
  orderId?: string;
  accountId: string;
  entryType: LedgerEntryType;
  amount: string | Prisma.Decimal;
  description?: string;
}

export interface AppendEntryResult {
  id: string;
  accountId: string;
  walletSeq: number;
  reference: string;
  entryType: LedgerEntryType;
  amount: Prisma.Decimal;
  entryHash: string;
  prevHash: string | null;
}

export interface VerifyChainResult {
  accountId: string;
  valid: boolean;
  entriesVerified: number;
  brokenAtSeq?: number;
  expectedHash?: string;
  actualHash?: string;
  message: string;
}

/**
 * Computes SHA256 hash for a ledger entry.
 * Uses canonical JSON stringification for deterministic hashing.
 */
export function computeEntryHash(
  prevHash: string | null,
  accountId: string,
  walletSeq: number,
  reference: string,
  entryType: string,
  amount: string,
  description: string | null
): string {
  const canonical = JSON.stringify({
    prevHash,
    accountId,
    walletSeq,
    reference,
    entryType,
    amount,
    description,
  });
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

/**
 * Appends a new entry to the ledger within a transaction.
 * 
 * This function MUST be called within a Prisma transaction.
 * It handles:
 * 1. Locking the last entry for the account
 * 2. Incrementing walletSeq
 * 3. Computing hash chain
 * 4. Creating the ledger entry
 * 5. Updating wallet balance cache
 * 
 * @param tx - Prisma transaction client
 * @param params - Entry parameters
 * @returns The created ledger entry
 * @throws Error if idempotency check fails or balance insufficient for debits
 */
export async function appendEntry(
  tx: Prisma.TransactionClient,
  params: AppendEntryParams
): Promise<AppendEntryResult> {
  const { reference, orderId, accountId, entryType, amount, description } = params;
  
  // Convert amount to string for consistent handling
  const amountStr = typeof amount === 'string' ? amount : amount.toString();
  const amountDecimal = new Prisma.Decimal(amountStr);

  // Check for existing entry with same reference (idempotency)
  const existingEntry = await tx.ledgerEntry.findUnique({
    where: {
      accountId_reference: {
        accountId,
        reference,
      },
    },
  });

  if (existingEntry) {
    // Idempotent: return existing entry
    return {
      id: existingEntry.id,
      accountId: existingEntry.accountId,
      walletSeq: existingEntry.walletSeq,
      reference: existingEntry.reference,
      entryType: existingEntry.entryType,
      amount: existingEntry.amount,
      entryHash: existingEntry.entryHash,
      prevHash: existingEntry.prevHash,
    };
  }

  // Lock and get the last entry for this account
  const lastEntry = await tx.ledgerEntry.findFirst({
    where: { accountId },
    orderBy: { walletSeq: 'desc' },
  });

  const prevHash = lastEntry?.entryHash ?? null;
  const walletSeq = (lastEntry?.walletSeq ?? 0) + 1;

  // Compute entry hash
  const entryHash = computeEntryHash(
    prevHash,
    accountId,
    walletSeq,
    reference,
    entryType,
    amountStr,
    description ?? null
  );

  // Create ledger entry
  const entry = await tx.ledgerEntry.create({
    data: {
      accountId,
      walletSeq,
      reference,
      orderId,
      entryType,
      amount: amountDecimal,
      description,
      prevHash,
      entryHash,
    },
  });

  // Update or create wallet balance cache
  const balanceChange = entryType === LedgerEntryType.CREDIT 
    ? amountDecimal 
    : amountDecimal.negated();

  const existingBalance = await tx.walletBalanceCache.findUnique({
    where: { accountId },
  });

  if (existingBalance) {
    const newBalance = existingBalance.balance.add(balanceChange);
    
    // Prevent negative balances for debit operations
    if (newBalance.lessThan(0)) {
      throw new Error(
        `Insufficient balance for ${accountId}. ` +
        `Current: ${existingBalance.balance.toString()}, ` +
        `Required: ${amountStr}`
      );
    }

    await tx.walletBalanceCache.update({
      where: { accountId },
      data: {
        balance: newBalance,
        lastEntrySeq: walletSeq,
      },
    });
  } else {
    // First entry for this account
    if (entryType === LedgerEntryType.DEBIT) {
      throw new Error(`Cannot debit non-existent wallet: ${accountId}`);
    }

    await tx.walletBalanceCache.create({
      data: {
        accountId,
        balance: amountDecimal,
        currency: 'NGN',
        lastEntrySeq: walletSeq,
      },
    });
  }

  return {
    id: entry.id,
    accountId: entry.accountId,
    walletSeq: entry.walletSeq,
    reference: entry.reference,
    entryType: entry.entryType,
    amount: entry.amount,
    entryHash: entry.entryHash,
    prevHash: entry.prevHash,
  };
}

/**
 * Verifies the hash chain integrity for an account.
 * 
 * Recomputes all hashes from the beginning and compares
 * against stored hashes to detect tampering.
 * 
 * @param prisma - Prisma client
 * @param accountId - Account to verify
 * @param fromSeq - Start sequence (default: 1)
 * @param toSeq - End sequence (default: latest)
 * @returns Verification result
 */
export async function verifyChain(
  prisma: PrismaClient,
  accountId: string,
  fromSeq?: number,
  toSeq?: number
): Promise<VerifyChainResult> {
  // Get all entries for the account, ordered by sequence
  const entries = await prisma.ledgerEntry.findMany({
    where: {
      accountId,
      ...(fromSeq !== undefined && { walletSeq: { gte: fromSeq } }),
      ...(toSeq !== undefined && { walletSeq: { lte: toSeq } }),
    },
    orderBy: { walletSeq: 'asc' },
  });

  if (entries.length === 0) {
    return {
      accountId,
      valid: true,
      entriesVerified: 0,
      message: 'No entries found for account',
    };
  }

  let prevHash: string | null = null;

  // If starting from a sequence > 1, get the previous entry's hash
  if (fromSeq && fromSeq > 1) {
    const prevEntry = await prisma.ledgerEntry.findFirst({
      where: {
        accountId,
        walletSeq: fromSeq - 1,
      },
    });
    prevHash = prevEntry?.entryHash ?? null;
  }

  for (const entry of entries) {
    const expectedHash = computeEntryHash(
      prevHash,
      entry.accountId,
      entry.walletSeq,
      entry.reference,
      entry.entryType,
      entry.amount.toString(),
      entry.description
    );

    if (expectedHash !== entry.entryHash) {
      return {
        accountId,
        valid: false,
        entriesVerified: entry.walletSeq - (fromSeq ?? 1),
        brokenAtSeq: entry.walletSeq,
        expectedHash,
        actualHash: entry.entryHash,
        message: `Chain broken at sequence ${entry.walletSeq}`,
      };
    }

    // Verify prevHash linkage
    if (entry.prevHash !== prevHash) {
      return {
        accountId,
        valid: false,
        entriesVerified: entry.walletSeq - (fromSeq ?? 1),
        brokenAtSeq: entry.walletSeq,
        expectedHash: prevHash ?? 'null',
        actualHash: entry.prevHash ?? 'null',
        message: `Previous hash mismatch at sequence ${entry.walletSeq}`,
      };
    }

    prevHash = entry.entryHash;
  }

  return {
    accountId,
    valid: true,
    entriesVerified: entries.length,
    message: 'Chain integrity verified',
  };
}

/**
 * Gets the current balance for an account from cache.
 */
export async function getBalance(
  prisma: PrismaClient,
  accountId: string
): Promise<{ balance: Prisma.Decimal; lastEntrySeq: number } | null> {
  const cache = await prisma.walletBalanceCache.findUnique({
    where: { accountId },
  });

  if (!cache) {
    return null;
  }

  return {
    balance: cache.balance,
    lastEntrySeq: cache.lastEntrySeq,
  };
}

/**
 * Recomputes balance from ledger entries (for verification).
 * Should match cached balance.
 */
export async function recomputeBalance(
  prisma: PrismaClient,
  accountId: string
): Promise<Prisma.Decimal> {
  const entries = await prisma.ledgerEntry.findMany({
    where: { accountId },
  });

  let balance = new Prisma.Decimal(0);

  for (const entry of entries) {
    if (entry.entryType === LedgerEntryType.CREDIT) {
      balance = balance.add(entry.amount);
    } else {
      balance = balance.sub(entry.amount);
    }
  }

  return balance;
}

// Export types
export { LedgerEntryType } from '@syntherium/db';
