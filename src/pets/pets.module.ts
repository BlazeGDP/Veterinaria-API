import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ExternalModule } from '../external/external.module';
import { Pet } from './pet.entity';
import { Owner } from '../owners/owner.entity';

import { PetsController } from './pets.controller';
import { PetsService } from './pets.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Pet,
      Owner,
    ]),
    ExternalModule,
  ],

  controllers: [PetsController],

  providers: [PetsService],

  exports: [PetsService],
})
export class PetsModule {}
