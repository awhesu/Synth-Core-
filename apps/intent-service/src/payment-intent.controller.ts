import { Controller, Post, Get, Param, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { PaymentIntentService, CreatePaymentIntentDto } from './payment-intent.service';

@Controller('intents/payments')
export class PaymentIntentController {
  constructor(private readonly paymentIntentService: PaymentIntentService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreatePaymentIntentDto) {
    const intent = await this.paymentIntentService.create(dto);
    return this.formatResponse(intent);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const intent = await this.paymentIntentService.findById(id);
    return this.formatResponse(intent);
  }

  private formatResponse(intent: any) {
    return {
      id: intent.id,
      reference: intent.reference,
      orderId: intent.orderId,
      amount: intent.amount.toString(),
      originalAmount: intent.originalAmount.toString(),
      discountAmount: intent.discountAmount.toString(),
      discountCode: intent.discountCode,
      provider: intent.provider,
      providerRef: intent.providerRef,
      currency: intent.currency,
      status: intent.status,
      metadata: intent.metadata,
      createdAt: intent.createdAt.toISOString(),
      updatedAt: intent.updatedAt.toISOString(),
    };
  }
}
