import { Module } from '@nestjs/common';

import { MetricsModule } from './metrics/metrics.module';
import { OrchestratorController } from './orchestrator/orchestrator.controller';
import { OrchestratorService } from './orchestrator/orchestrator.service';

@Module({
  imports: [
    MetricsModule,
  ],
  controllers: [
    OrchestratorController,
  ],
  providers: [
    OrchestratorService,
  ],
})
export class AppModule {}
