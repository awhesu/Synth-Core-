import { Controller, Get } from '@nestjs/common';
import { Public } from '@syntherium/security';

@Controller()
export class HealthController {
  @Public()
  @Get('health')
  getHealth() {
    return {
      status: 'healthy',
      service: 'api-gateway',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
    };
  }

  @Public()
  @Get('ready')
  getReady() {
    // TODO: Check downstream service health
    return {
      status: 'ready',
      service: 'api-gateway',
      timestamp: new Date().toISOString(),
    };
  }
}
