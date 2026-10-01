import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';

import { OwnersService } from './owners.service';
import { CreateOwnerDto } from './dto/create-owner.dto';
import { UpdateOwnerDto } from './dto/update-owner.dto';
import { Owner } from './owner.entity';

type TraceRequest = FastifyRequest & {
  traceId: string;
};

@Controller('owners')
export class OwnersController {
  constructor(
    private readonly ownersService: OwnersService,
  ) {}

  @Post()
  create(
    @Body() createOwnerDto: CreateOwnerDto,
  ): Promise<Owner> {
    return this.ownersService.create(createOwnerDto);
  }

  @Get()
  findAll(
    @Req() request: TraceRequest,
  ): Promise<unknown[]> {
    return this.ownersService.findAll(
      request.traceId,
    );
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Req() request: TraceRequest,
  ): Promise<unknown[]> {
    return this.ownersService.findOne(
      id,
      request.traceId,
    );
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateOwnerDto: UpdateOwnerDto,
  ): Promise<Owner> {
    return this.ownersService.update(
      id,
      updateOwnerDto,
    );
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
  ): Promise<void> {
    return this.ownersService.remove(id);
  }
}
