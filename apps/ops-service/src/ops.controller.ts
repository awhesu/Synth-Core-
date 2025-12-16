import { Controller, Get, Post, Query, Body, Req } from '@nestjs/common';
import { OpsService } from './ops.service';
import { Roles, Role, UserContext } from '@syntherium/security';
import { WebhookStatus } from '@syntherium/db';

@Controller('ops')
export class OpsController {
  constructor(private readonly opsService: OpsService) {}

  @Get('webhook-inbox')
  @Roles(Role.OPS, Role.ADMIN)
  async searchWebhookInbox(
    @Query('provider') provider?: string,
    @Query('status') status?: WebhookStatus,
    @Query('reference') reference?: string,
    @Query('providerEventId') providerEventId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.opsService.searchWebhookInbox({
      provider,
      status,
      reference,
      providerEventId,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get('ledger-entries')
  @Roles(Role.OPS, Role.ADMIN)
  async searchLedgerEntries(
    @Query('accountId') accountId?: string,
    @Query('reference') reference?: string,
    @Query('orderId') orderId?: string,
    @Query('entryType') entryType?: string,
    @Query('minAmount') minAmount?: string,
    @Query('maxAmount') maxAmount?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.opsService.searchLedgerEntries({
      accountId,
      reference,
      orderId,
      entryType,
      minAmount,
      maxAmount,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Post('replay-webhook')
  @Roles(Role.ADMIN)
  async replayWebhook(@Body() body: { webhookId: string; reason: string }, @Req() req: any) {
    const user = req.user as UserContext;
    return this.opsService.replayWebhook(body.webhookId, body.reason, user?.id || 'unknown');
  }

  @Post('verify-chain')
  @Roles(Role.OPS, Role.ADMIN)
  async verifyChain(@Body() body: { accountIds?: string[]; verifyAll?: boolean }) {
    return this.opsService.verifyChains(body.accountIds || [], body.verifyAll || false);
  }
}
