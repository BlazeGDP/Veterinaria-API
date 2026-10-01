import { Module } from '@nestjs/common';

import { MetricsModule } from '../metrics/metrics.module';
import { ExternalApiService } from './external-api.service';

@Module({
  imports: [MetricsModule],
  providers: [ExternalApiService],
  exports: [ExternalApiService],
})
export class ExternalModule {}
