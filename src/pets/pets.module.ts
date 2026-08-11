import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

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
  ],

  controllers: [PetsController],

  providers: [PetsService],

  exports: [PetsService],
})
export class PetsModule {}