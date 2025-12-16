import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('health')
  getHealth() {
    return {
      status: 'healthy',
      service: 'orders-service',
      timestamp: new Date().toISOString(),
    };
  }
}
