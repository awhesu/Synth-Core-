/**
 * Orders Service
 * 
 * Order lifecycle management.
 * CRITICAL: This service does NOT write ledger entries.
 */

import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { OrderStatus, DeliveryType, PaymentIntentStatus, Prisma } from '@syntherium/db';
import { generatePaymentReference } from '@syntherium/idempotency';
import { createLogger } from '@syntherium/observability';

const logger = createLogger('orders-service');

export interface CreateOrderDto {
  customerId: string;
  vendorId: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: string;
  }>;
  deliveryAddress?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    coordinates?: { lat: number; lng: number };
  };
  deliveryType: DeliveryType;
  notes?: string;
}

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateOrderDto) {
    // Calculate totals
    let subtotal = new Prisma.Decimal(0);
    for (const item of dto.items) {
      const itemTotal = new Prisma.Decimal(item.unitPrice).mul(item.quantity);
      subtotal = subtotal.add(itemTotal);
    }
    
    const deliveryFee = dto.deliveryType === DeliveryType.DELIVERY 
      ? new Prisma.Decimal('500.0000') // TODO: Calculate based on distance
      : new Prisma.Decimal(0);
    
    const totalAmount = subtotal.add(deliveryFee);

    const order = await this.prisma.order.create({
      data: {
        customerId: dto.customerId,
        vendorId: dto.vendorId,
        subtotal,
        deliveryFee,
        totalAmount,
        deliveryType: dto.deliveryType,
        deliveryAddressJson: dto.deliveryAddress as Prisma.JsonObject,
        status: OrderStatus.PENDING,
        notes: dto.notes,
        items: {
          create: dto.items.map(item => ({
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
        },
      },
      include: { items: true },
    });

    logger.info('Order created', { orderId: order.id, customerId: dto.customerId, vendorId: dto.vendorId });
    return this.formatOrder(order);
  }

  async findById(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException(`Order not found: ${id}`);
    }

    return this.formatOrder(order);
  }

  async accept(id: string, dto: { estimatedDeliveryTime?: Date; driverId?: string }) {
    return this.transitionStatus(id, OrderStatus.PENDING, OrderStatus.ACCEPTED, {
      estimatedDeliveryTime: dto.estimatedDeliveryTime,
      driverId: dto.driverId,
    });
  }

  async dispatch(id: string, dto: { driverId?: string }) {
    return this.transitionStatus(id, OrderStatus.ACCEPTED, OrderStatus.DISPATCHED, {
      driverId: dto.driverId,
    });
  }

  async deliver(id: string, dto: { deliveredAt?: Date }) {
    return this.transitionStatus(id, OrderStatus.DISPATCHED, OrderStatus.DELIVERED, {
      deliveredAt: dto.deliveredAt || new Date(),
    });
  }

  async cancel(id: string, dto: { reason: string; description?: string }) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    
    if (!order) {
      throw new NotFoundException(`Order not found: ${id}`);
    }

    // Can only cancel PENDING or ACCEPTED orders
    if (![OrderStatus.PENDING, OrderStatus.ACCEPTED].includes(order.status)) {
      throw new BadRequestException({
        code: 'CANNOT_CANCEL',
        message: `Cannot cancel order in status: ${order.status}`,
      });
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: OrderStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: `${dto.reason}${dto.description ? `: ${dto.description}` : ''}`,
      },
      include: { items: true },
    });

    logger.info('Order cancelled', { orderId: id, reason: dto.reason });
    return this.formatOrder(updated);
  }

  async getFinancialStatus(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { paymentIntents: true },
    });

    if (!order) {
      throw new NotFoundException(`Order not found: ${orderId}`);
    }

    const paymentIntent = order.paymentIntents[0]; // Most recent
    
    const isPaid = paymentIntent?.status === PaymentIntentStatus.SETTLED;
    
    let paymentStatus = 'NO_PAYMENT';
    let message = 'No payment initiated';
    
    if (paymentIntent) {
      paymentStatus = paymentIntent.status;
      message = this.getPaymentStatusMessage(paymentIntent.status, isPaid);
    }

    return {
      orderId: order.id,
      orderStatus: order.status,
      totalAmount: order.totalAmount.toString(),
      paidAmount: isPaid ? paymentIntent?.amount.toString() : null,
      discountAmount: paymentIntent?.discountAmount.toString() ?? null,
      paymentStatus,
      paymentIntentId: paymentIntent?.id ?? null,
      isPaid,
      message,
    };
  }

  private async transitionStatus(
    id: string,
    fromStatus: OrderStatus,
    toStatus: OrderStatus,
    data: Partial<{
      estimatedDeliveryTime: Date;
      driverId: string;
      deliveredAt: Date;
    }>
  ) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    
    if (!order) {
      throw new NotFoundException(`Order not found: ${id}`);
    }

    if (order.status !== fromStatus) {
      throw new BadRequestException({
        code: 'INVALID_STATE_TRANSITION',
        message: `Cannot transition from ${order.status} to ${toStatus}`,
        details: { currentStatus: order.status, expectedStatus: fromStatus },
      });
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: { status: toStatus, ...data },
      include: { items: true },
    });

    logger.info('Order status updated', { orderId: id, from: fromStatus, to: toStatus });
    return this.formatOrder(updated);
  }

  private getPaymentStatusMessage(status: PaymentIntentStatus, isPaid: boolean): string {
    if (isPaid) return 'Payment settled successfully';
    switch (status) {
      case PaymentIntentStatus.PENDING: return 'Awaiting payment';
      case PaymentIntentStatus.INITIATED: return 'Payment initiated';
      case PaymentIntentStatus.CONFIRMING: return 'Payment confirming';
      case PaymentIntentStatus.FAILED: return 'Payment failed';
      case PaymentIntentStatus.EXPIRED: return 'Payment expired';
      case PaymentIntentStatus.REFUNDED: return 'Payment refunded';
      default: return 'Unknown payment status';
    }
  }

  private formatOrder(order: any) {
    return {
      id: order.id,
      customerId: order.customerId,
      vendorId: order.vendorId,
      items: order.items?.map((item: any) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toString(),
      })),
      subtotal: order.subtotal.toString(),
      deliveryFee: order.deliveryFee.toString(),
      totalAmount: order.totalAmount.toString(),
      deliveryAddress: order.deliveryAddressJson,
      deliveryType: order.deliveryType,
      status: order.status,
      driverId: order.driverId,
      estimatedDeliveryTime: order.estimatedDeliveryTime?.toISOString(),
      deliveredAt: order.deliveredAt?.toISOString(),
      cancelledAt: order.cancelledAt?.toISOString(),
      cancellationReason: order.cancellationReason,
      notes: order.notes,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    };
  }
}
