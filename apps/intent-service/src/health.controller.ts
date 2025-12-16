import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('health')
  getHealth() {
    return {
      status: 'healthy',
      service: 'intent-service',
      timestamp: new Date().toISOString(),
    };
  }
}
