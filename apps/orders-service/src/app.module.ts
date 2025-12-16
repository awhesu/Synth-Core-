import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PrismaService } from './prisma.service';

@Module({
  controllers: [HealthController, OrdersController],
  providers: [PrismaService, OrdersService],
})
export class AppModule {}
