import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { PetsService } from './pets.service';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';
import { Pet } from './pet.entity';

@Controller('pets')
export class PetsController {
  constructor(private readonly petsService: PetsService) {}

  @Post()
  create(@Body() createPetDto: CreatePetDto): Promise<Pet> {
    return this.petsService.create(createPetDto);
  }

  @Get()
  findAll(
    @Query('especie') especie?: string,
    @Query('ownerId') ownerId?: string,
  ): Promise<Pet[]> {
    return this.petsService.findAll(especie, ownerId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Pet> {
    return this.petsService.findOne(id.toString());
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePetDto: UpdatePetDto,
  ): Promise<Pet> {
    return this.petsService.update(id.toString(), updatePetDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.petsService.remove(id.toString());
  }
}