import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Pet } from './pet.entity';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';

@Injectable()
export class PetsService {
  constructor(
    @InjectRepository(Pet)
    private readonly petsRepository: Repository<Pet>,
  ) {}

  async create(createPetDto: CreatePetDto): Promise<Pet> {
    const pet = this.petsRepository.create({
      nombre: createPetDto.nombre,
      especie: createPetDto.especie,
      raza: createPetDto.raza,
      edad: createPetDto.edad,
      ownerId: createPetDto.ownerId.toString(),
    });

    return this.petsRepository.save(pet);
  }

  async findAll(
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

  async findOne(id: string): Promise<Pet> {
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

  async update(
    id: string,
    updatePetDto: UpdatePetDto,
  ): Promise<Pet> {
    const pet = await this.findOne(id);

    pet.nombre = updatePetDto.nombre ?? pet.nombre;
    pet.especie = updatePetDto.especie ?? pet.especie;
    pet.raza = updatePetDto.raza ?? pet.raza;
    pet.edad = updatePetDto.edad ?? pet.edad;

    if (updatePetDto.ownerId !== undefined) {
      pet.ownerId = updatePetDto.ownerId.toString();
    }

    return this.petsRepository.save(pet);
  }

  async remove(id: string): Promise<void> {
    const pet = await this.findOne(id);

    await this.petsRepository.remove(pet);
  }
}