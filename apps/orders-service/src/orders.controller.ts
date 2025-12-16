import { Controller, Post, Get, Param, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { OrdersService, CreateOrderDto } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateOrderDto) {
    return this.ordersService.create(dto);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.ordersService.findById(id);
  }

  @Post(':id/accept')
  async accept(@Param('id') id: string, @Body() dto: { estimatedDeliveryTime?: string; driverId?: string }) {
    return this.ordersService.accept(id, {
      estimatedDeliveryTime: dto.estimatedDeliveryTime ? new Date(dto.estimatedDeliveryTime) : undefined,
      driverId: dto.driverId,
    });
  }

  @Post(':id/dispatch')
  async dispatch(@Param('id') id: string, @Body() dto: { driverId?: string }) {
    return this.ordersService.dispatch(id, dto);
  }

  @Post(':id/deliver')
  async deliver(@Param('id') id: string, @Body() dto: { deliveredAt?: string }) {
    return this.ordersService.deliver(id, {
      deliveredAt: dto.deliveredAt ? new Date(dto.deliveredAt) : undefined,
    });
  }

  @Post(':id/cancel')
  async cancel(@Param('id') id: string, @Body() dto: { reason: string; description?: string }) {
    return this.ordersService.cancel(id, dto);
  }

  @Get(':id/financial-status')
  async getFinancialStatus(@Param('id') id: string) {
    return this.ordersService.getFinancialStatus(id);
  }
}
