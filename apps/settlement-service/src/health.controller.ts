import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('health')
  getHealth() {
    return {
      status: 'healthy',
      service: 'settlement-service',
      timestamp: new Date().toISOString(),
      role: 'LEDGER_WRITER',
    };
  }
}
