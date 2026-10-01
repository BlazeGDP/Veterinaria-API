import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ExternalApiService } from '../external/external-api.service';
import { Owner } from './owner.entity';
import { CreateOwnerDto } from './dto/create-owner.dto';
import { UpdateOwnerDto } from './dto/update-owner.dto';

@Injectable()
export class OwnersService {
  constructor(
    @InjectRepository(Owner)
    private readonly ownersRepository: Repository<Owner>,

    private readonly externalApiService: ExternalApiService,
  ) {}

  async create(createOwnerDto: CreateOwnerDto): Promise<Owner> {
    const existingOwner = await this.ownersRepository.findOne({
      where: {
        email: createOwnerDto.email,
      },
    });

    if (existingOwner) {
      throw new ConflictException(
        'Ya existe un dueño registrado con ese email',
      );
    }

    const owner = this.ownersRepository.create(createOwnerDto);

    return this.ownersRepository.save(owner);
  }

  async findAll(traceId: string): Promise<unknown[]> {
    const owners = await this.findAllEntities();

    return this.externalApiService.appendRandomExternalEntities(
      owners,
      traceId,
    );
  }

  async findOne(
    id: string,
    traceId: string,
  ): Promise<unknown[]> {
    const owner = await this.findOneEntity(id);

    return this.externalApiService.appendRandomExternalEntities(
      [owner],
      traceId,
    );
  }

  async update(
    id: string,
    updateOwnerDto: UpdateOwnerDto,
  ): Promise<Owner> {
    const owner = await this.findOneEntity(id);

    if (
      updateOwnerDto.email &&
      updateOwnerDto.email !== owner.email
    ) {
      const existingOwner = await this.ownersRepository.findOne({
        where: {
          email: updateOwnerDto.email,
        },
      });

      if (existingOwner) {
        throw new ConflictException(
          'Ya existe un dueño registrado con ese email',
        );
      }
    }

    Object.assign(owner, updateOwnerDto);

    return this.ownersRepository.save(owner);
  }

  async remove(id: string): Promise<void> {
    const owner = await this.findOneEntity(id);

    await this.ownersRepository.remove(owner);
  }

  private async findAllEntities(): Promise<Owner[]> {
    return this.ownersRepository.find({
      relations: ['pets'],
    });
  }

  private async findOneEntity(id: string): Promise<Owner> {
    const owner = await this.ownersRepository.findOne({
      where: { id },
      relations: ['pets'],
    });

    if (!owner) {
      throw new NotFoundException(
        `No existe un dueño con ID ${id}`,
      );
    }

    return owner;
  }
}
