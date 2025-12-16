import { Controller, Get } from '@nestjs/common';
import { Public } from '@syntherium/security';

@Controller()
export class HealthController {
  @Public()
  @Get('health')
  getHealth() {
    return {
      status: 'healthy',
      service: 'ops-service',
      timestamp: new Date().toISOString(),
    };
  }
}
