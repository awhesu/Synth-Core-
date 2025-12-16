import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('health')
  getHealth() {
    return {
      status: 'healthy',
      service: 'ledger-service',
      timestamp: new Date().toISOString(),
      role: 'LEDGER_READER',
    };
  }
}
