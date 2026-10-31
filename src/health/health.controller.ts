import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      version: process.env.APP_VERSION || 'local',
      track: process.env.APP_TRACK || 'local',
    };
  }
}
