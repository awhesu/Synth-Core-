import { Controller, Get, Post, Param, Query, Body } from '@nestjs/common';
import { LedgerQueryService, LedgerEntryQuery } from './ledger-query.service';
import { LedgerEntryType } from '@syntherium/db';

@Controller()
export class LedgerController {
  constructor(private readonly ledgerQueryService: LedgerQueryService) {}

  @Get('ledger/entries')
  async getEntries(
    @Query('accountId') accountId?: string,
    @Query('reference') reference?: string,
    @Query('orderId') orderId?: string,
    @Query('entryType') entryType?: LedgerEntryType,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const query: LedgerEntryQuery = {
      accountId,
      reference,
      orderId,
      entryType,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    };

    return this.ledgerQueryService.getEntries(query);
  }

  @Get('wallets/:accountId/balance')
  async getWalletBalance(@Param('accountId') accountId: string) {
    return this.ledgerQueryService.getWalletBalance(accountId);
  }

  @Post('ledger/verify-chain')
  async verifyChain(@Body() body: { accountId: string; fromSeq?: number; toSeq?: number }) {
    return this.ledgerQueryService.verifyChainIntegrity(body.accountId, body.fromSeq, body.toSeq);
  }
}
