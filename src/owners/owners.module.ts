import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Owner } from './owner.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Owner])],
  providers: [],
  controllers: [],
  exports: [],
})
export class OwnersModule {}
