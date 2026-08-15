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
  OnModuleInit,
} from '@nestjs/common';

import { HttpAdapterHost } from '@nestjs/core';

import { PetsService } from './pets.service';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';

@Controller('pets')
export class PetsController implements OnModuleInit {
  constructor(
    private readonly petsService: PetsService,
    private readonly httpAdapterHost: HttpAdapterHost,
  ) {}

  onModuleInit() {
    const fastify = this.httpAdapterHost.httpAdapter.getInstance();

    fastify.route({
      method: 'QUERY',
      url: '/pets',
      handler: async (request: any) => {
        const body = request.body as {
          especie?: string;
          ownerId?: string | number;
        };

        return this.petsService.findAll(
          body?.especie,
          body?.ownerId !== undefined
            ? body.ownerId.toString()
            : undefined,
        );
      },
    });
  }

  @Post()
  create(@Body() createPetDto: CreatePetDto) {
    return this.petsService.create(createPetDto);
  }

  @Get()
  findAll(
    @Query('especie') especie?: string,
    @Query('ownerId') ownerId?: string,
  ) {
    return this.petsService.findAll(especie, ownerId);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.petsService.findOne(id.toString());
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePetDto: UpdatePetDto,
  ) {
    return this.petsService.update(
      id.toString(),
      updatePetDto,
    );
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.petsService.remove(id.toString());
  }
}