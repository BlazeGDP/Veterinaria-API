import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Delete,
  OnModuleInit,
  Req,
} from '@nestjs/common';

import { HttpAdapterHost } from '@nestjs/core';
import { FastifyRequest } from 'fastify';

import { PetsService } from './pets.service';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';

type TraceRequest = FastifyRequest & {
  traceId: string;
};

@Controller('pets')
export class PetsController implements OnModuleInit {
  constructor(
    private readonly petsService: PetsService,
    private readonly httpAdapterHost: HttpAdapterHost,
  ) {}

  onModuleInit() {
    const fastify =
      this.httpAdapterHost.httpAdapter.getInstance();

    fastify.route({
      method: 'QUERY',
      url: '/pets',
      handler: async (
        request: TraceRequest & {
          body?: {
            especie?: string;
            ownerId?: string | number;
          };
        },
      ) => {
        const body = request.body;

        return this.petsService.findAll(
          body?.especie,
          body?.ownerId !== undefined
            ? body.ownerId.toString()
            : undefined,
          request.traceId,
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
    @Query('especie') especie: string | undefined,
    @Query('ownerId') ownerId: string | undefined,
    @Req() request: TraceRequest,
  ) {
    return this.petsService.findAll(
      especie,
      ownerId,
      request.traceId,
    );
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: TraceRequest,
  ) {
    return this.petsService.findOne(
      id.toString(),
      request.traceId,
    );
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
