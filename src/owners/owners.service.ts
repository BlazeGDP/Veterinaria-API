import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Owner } from './owner.entity';
import { CreateOwnerDto } from './dto/create-owner.dto';
import { UpdateOwnerDto } from './dto/update-owner.dto';

@Injectable()
export class OwnersService {
  constructor(
    @InjectRepository(Owner)
    private readonly ownersRepository: Repository<Owner>,
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

  async findAll(): Promise<Owner[]> {
    return this.ownersRepository.find({
      relations: ['pets'],
    });
  }

  async findOne(id: string): Promise<Owner> {
    const owner = await this.ownersRepository.findOne({
      where: { id },
      relations: ['pets'],
    });

    if (!owner) {
      throw new NotFoundException(`No existe un dueño con ID ${id}`);
    }

    return owner;
  }

  async update(
    id: string,
    updateOwnerDto: UpdateOwnerDto,
  ): Promise<Owner> {
    const owner = await this.findOne(id);

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
    const owner = await this.findOne(id);

    await this.ownersRepository.remove(owner);
  }
}