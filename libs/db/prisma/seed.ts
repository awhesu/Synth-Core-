/**
 * Syntherium Database Seed Script
 * 
 * Creates system accounts/wallets required for platform operation:
 * - MARKETING_WALLET: Source for discount subsidies
 * - PLATFORM_ESCROW: Receives payments, holds funds
 * - LEGACY_MIGRATION_WALLET: For data migration entries
 */

import { PrismaClient, LedgerEntryType } from './generated/prisma';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

// System account identifiers
const SYSTEM_ACCOUNTS = [
  {
    accountId: 'MARKETING_WALLET',
    initialBalance: '1000000.0000', // 1M NGN initial marketing budget
    description: 'Marketing subsidy wallet for discount campaigns',
  },
  {
    accountId: 'PLATFORM_ESCROW',
    initialBalance: '0.0000',
    description: 'Platform escrow for payment collection',
  },
  {
    accountId: 'LEGACY_MIGRATION_WALLET',
    initialBalance: '0.0000',
    description: 'Wallet for legacy data migration entries',
  },
];

function computeEntryHash(
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

async function main() {
  console.log('🌱 Starting Syntherium database seed...\n');

  for (const account of SYSTEM_ACCOUNTS) {
    console.log(`Creating system account: ${account.accountId}`);

    // Check if wallet already exists
    const existingWallet = await prisma.walletBalanceCache.findUnique({
      where: { accountId: account.accountId },
    });

    if (existingWallet) {
      console.log(`  ⏭️  Account ${account.accountId} already exists, skipping.\n`);
      continue;
    }

    // Create initial balance cache entry
    await prisma.walletBalanceCache.create({
      data: {
        accountId: account.accountId,
        balance: account.initialBalance,
        currency: 'NGN',
        lastEntrySeq: account.initialBalance !== '0.0000' ? 1 : 0,
      },
    });

    // If there's an initial balance, create genesis ledger entry
    if (account.initialBalance !== '0.0000') {
      const reference = `GENESIS_${account.accountId}`;
      const description = `${account.description} - Initial funding`;
      const entryHash = computeEntryHash(
        null,
        account.accountId,
        1,
        reference,
        'CREDIT',
        account.initialBalance,
        description
      );

      await prisma.ledgerEntry.create({
        data: {
          accountId: account.accountId,
          walletSeq: 1,
          reference,
          entryType: LedgerEntryType.CREDIT,
          amount: account.initialBalance,
          description,
          prevHash: null,
          entryHash,
        },
      });

      console.log(`  ✅ Created with initial balance: ${account.initialBalance} NGN`);
      console.log(`  📝 Genesis entry hash: ${entryHash.substring(0, 16)}...\n`);
    } else {
      console.log(`  ✅ Created with zero balance\n`);
    }
  }

  console.log('✨ Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
