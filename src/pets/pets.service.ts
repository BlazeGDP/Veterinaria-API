import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ExternalApiService } from '../external/external-api.service';
import { Pet } from './pet.entity';
import { Owner } from '../owners/owner.entity';

import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';

@Injectable()
export class PetsService {
  constructor(
    @InjectRepository(Pet)
    private readonly petsRepository: Repository<Pet>,

    @InjectRepository(Owner)
    private readonly ownersRepository: Repository<Owner>,

    private readonly externalApiService: ExternalApiService,
  ) {}

  async create(createPetDto: CreatePetDto): Promise<Pet> {
    const owner = await this.ownersRepository.findOne({
      where: {
        id: createPetDto.ownerId.toString(),
      },
    });

    if (!owner) {
      throw new NotFoundException(
        `Dueño con ID ${createPetDto.ownerId} no encontrado`,
      );
    }

    const pet = this.petsRepository.create({
      nombre: createPetDto.nombre,
      especie: createPetDto.especie,
      raza: createPetDto.raza,
      edad: createPetDto.edad,
      ownerId: createPetDto.ownerId.toString(),
      owner,
    });

    await this.petsRepository.save(pet);

    return this.findOneEntity(pet.id);
  }

  async findAll(
    especie: string | undefined,
    ownerId: string | undefined,
    traceId: string,
  ): Promise<unknown[]> {
    const pets = await this.findAllEntities(
      especie,
      ownerId,
    );

    return this.externalApiService.appendRandomExternalEntities(
      pets,
      traceId,
    );
  }

  async findOne(
    id: string,
    traceId: string,
  ): Promise<unknown[]> {
    const pet = await this.findOneEntity(id);

    return this.externalApiService.appendRandomExternalEntities(
      [pet],
      traceId,
    );
  }

  async update(
    id: string,
    updatePetDto: UpdatePetDto,
  ): Promise<Pet> {
    const pet = await this.findOneEntity(id);

    pet.nombre = updatePetDto.nombre ?? pet.nombre;
    pet.especie = updatePetDto.especie ?? pet.especie;
    pet.raza = updatePetDto.raza ?? pet.raza;
    pet.edad = updatePetDto.edad ?? pet.edad;

    if (updatePetDto.ownerId !== undefined) {
      const owner = await this.ownersRepository.findOne({
        where: {
          id: updatePetDto.ownerId.toString(),
        },
      });

      if (!owner) {
        throw new NotFoundException(
          `Dueño con ID ${updatePetDto.ownerId} no encontrado`,
        );
      }

      pet.ownerId = updatePetDto.ownerId.toString();
      pet.owner = owner;
    }

    await this.petsRepository.save(pet);

    return this.findOneEntity(id);
  }

  async remove(id: string): Promise<void> {
    const pet = await this.findOneEntity(id);

    await this.petsRepository.remove(pet);
  }

  private async findAllEntities(
    especie?: string,
    ownerId?: string,
  ): Promise<Pet[]> {
    const where: any = {};

    if (especie) {
      where.especie = especie;
    }

    if (ownerId) {
      where.ownerId = ownerId;
    }

    return this.petsRepository.find({
      where,
      relations: ['owner'],
    });
  }

  private async findOneEntity(id: string): Promise<Pet> {
    const pet = await this.petsRepository.findOne({
      where: { id },
      relations: ['owner'],
    });

    if (!pet) {
      throw new NotFoundException(
        `Mascota con ID ${id} no encontrada`,
      );
    }

    return pet;
  }
}
