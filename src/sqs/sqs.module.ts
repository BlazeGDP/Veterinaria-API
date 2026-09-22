import { Module } from '@nestjs/common';
import { SqsController } from './sqs.controller';
import { SqsService } from './sqs.service';

@Module({
  controllers: [SqsController],
  providers: [SqsService],
  exports: [SqsService],
})
export class SqsModule {}