import { Module } from '@nestjs/common';
import { ExternalController } from './external.controller';
import { ExternalApiService } from './external-api.service';

@Module({
  controllers: [ExternalController],
  providers: [ExternalApiService],
  exports: [ExternalApiService],
})
export class ExternalModule {}