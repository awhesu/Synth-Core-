import { Controller, Post, Get, Param, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { RefundIntentService, CreateRefundIntentDto } from './refund-intent.service';

@Controller('intents/refunds')
export class RefundIntentController {
  constructor(private readonly refundIntentService: RefundIntentService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateRefundIntentDto) {
    const intent = await this.refundIntentService.create(dto);
    return this.formatResponse(intent);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const intent = await this.refundIntentService.findById(id);
    return this.formatResponse(intent);
  }

  private formatResponse(intent: any) {
    return {
      id: intent.id,
      reference: intent.reference,
      paymentIntentId: intent.paymentIntentId,
      amount: intent.amount.toString(),
      reason: intent.reason,
      description: intent.description,
      status: intent.status,
      createdAt: intent.createdAt.toISOString(),
      updatedAt: intent.updatedAt.toISOString(),
    };
  }
}
