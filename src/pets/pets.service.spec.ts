import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PetsService } from './pets.service';
import { Pet } from './pet.entity';
import { Owner } from '../owners/owner.entity';

describe('PetsService', () => {
  let service: PetsService;
  let petsRepository: jest.Mocked<Repository<Pet>>;
  let ownersRepository: jest.Mocked<Repository<Owner>>;

  const mockPetsRepository = {
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  const mockOwnersRepository = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule =
      await Test.createTestingModule({
        providers: [
          PetsService,

          {
            provide: getRepositoryToken(Pet),
            useValue: mockPetsRepository,
          },

          {
            provide: getRepositoryToken(Owner),
            useValue: mockOwnersRepository,
          },
        ],
      }).compile();

    service = module.get<PetsService>(
      PetsService,
    );

    petsRepository = module.get(
      getRepositoryToken(Pet),
    );

    ownersRepository = module.get(
      getRepositoryToken(Owner),
    );
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('debe crear una mascota correctamente', async () => {
      const dto = {
        nombre: 'Noah',
        especie: 'Perro',
        raza: 'Golden Retriever',
        edad: 4,
        ownerId: 1,
      };

      const owner = {
        id: '1',
        nombre: 'Guillermo',
      } as unknown as Owner;

      const pet = {
        id: '1',
        nombre: dto.nombre,
        especie: dto.especie,
        raza: dto.raza,
        edad: dto.edad,
        ownerId: '1',
        owner,
      } as unknown as Pet;

      ownersRepository.findOne.mockResolvedValue(owner);

      petsRepository.create.mockReturnValue(pet);

      petsRepository.save.mockResolvedValue(pet);

      petsRepository.findOne.mockResolvedValue(pet);

      const result = await service.create(dto);

      expect(
        ownersRepository.findOne,
      ).toHaveBeenCalledWith({
        where: {
          id: '1',
        },
      });

      expect(
        petsRepository.create,
      ).toHaveBeenCalledWith({
        nombre: dto.nombre,
        especie: dto.especie,
        raza: dto.raza,
        edad: dto.edad,
        ownerId: '1',
        owner,
      });

      expect(
        petsRepository.save,
      ).toHaveBeenCalledWith(pet);

      expect(
        petsRepository.findOne,
      ).toHaveBeenCalledWith({
        where: {
          id: '1',
        },
        relations: ['owner'],
      });

      expect(result).toEqual(pet);
    });

    it('debe lanzar NotFoundException si el dueño no existe', async () => {
      const dto = {
        nombre: 'Noah',
        especie: 'Perro',
        raza: 'Golden Retriever',
        edad: 4,
        ownerId: 999,
      };

      ownersRepository.findOne.mockResolvedValue(null);

      await expect(
        service.create(dto),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.create(dto),
      ).rejects.toThrow(
        'Dueño con ID 999 no encontrado',
      );

      expect(
        petsRepository.create,
      ).not.toHaveBeenCalled();

      expect(
        petsRepository.save,
      ).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('debe devolver todas las mascotas', async () => {
      const pets = [
        {
          id: '1',
          nombre: 'Noah',
          especie: 'Perro',
          ownerId: '1',
        },
        {
          id: '2',
          nombre: 'Milo',
          especie: 'Gato',
          ownerId: '2',
        },
      ] as unknown as Pet[];

      petsRepository.find.mockResolvedValue(pets);

      const result = await service.findAll();

      expect(
        petsRepository.find,
      ).toHaveBeenCalledWith({
        where: {},
        relations: ['owner'],
      });

      expect(result).toEqual(pets);
    });

    it('debe filtrar mascotas por especie', async () => {
      const pets = [
        {
          id: '1',
          nombre: 'Noah',
          especie: 'Perro',
        },
      ] as unknown as Pet[];

      petsRepository.find.mockResolvedValue(pets);

      const result = await service.findAll('Perro');

      expect(
        petsRepository.find,
      ).toHaveBeenCalledWith({
        where: {
          especie: 'Perro',
        },
        relations: ['owner'],
      });

      expect(result).toEqual(pets);
    });

    it('debe filtrar mascotas por ownerId', async () => {
      const pets = [
        {
          id: '1',
          nombre: 'Noah',
          ownerId: '2',
        },
      ] as unknown as Pet[];

      petsRepository.find.mockResolvedValue(pets);

      const result = await service.findAll(
        undefined,
        '2',
      );

      expect(
        petsRepository.find,
      ).toHaveBeenCalledWith({
        where: {
          ownerId: '2',
        },
        relations: ['owner'],
      });

      expect(result).toEqual(pets);
    });

    it('debe filtrar mascotas por especie y ownerId', async () => {
      const pets = [
        {
          id: '1',
          nombre: 'Noah',
          especie: 'Perro',
          ownerId: '2',
        },
      ] as unknown as Pet[];

      petsRepository.find.mockResolvedValue(pets);

      const result = await service.findAll(
        'Perro',
        '2',
      );

      expect(
        petsRepository.find,
      ).toHaveBeenCalledWith({
        where: {
          especie: 'Perro',
          ownerId: '2',
        },
        relations: ['owner'],
      });

      expect(result).toEqual(pets);
    });
  });

  describe('findOne', () => {
    it('debe encontrar una mascota por ID', async () => {
      const pet = {
        id: '1',
        nombre: 'Noah',
        especie: 'Perro',
      } as unknown as Pet;

      petsRepository.findOne.mockResolvedValue(pet);

      const result = await service.findOne('1');

      expect(
        petsRepository.findOne,
      ).toHaveBeenCalledWith({
        where: {
          id: '1',
        },
        relations: ['owner'],
      });

      expect(result).toEqual(pet);
    });

    it('debe lanzar NotFoundException si la mascota no existe', async () => {
      petsRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findOne('999'),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.findOne('999'),
      ).rejects.toThrow(
        'Mascota con ID 999 no encontrada',
      );
    });
  });

  describe('update', () => {
    it('debe actualizar una mascota correctamente', async () => {
      const pet = {
        id: '1',
        nombre: 'Noah',
        especie: 'Perro',
        raza: 'Golden Retriever',
        edad: 4,
        ownerId: '1',
      } as unknown as Pet;

      petsRepository.findOne.mockResolvedValue(pet);

      petsRepository.save.mockResolvedValue(pet);

      const dto = {
        nombre: 'Noah actualizado',
        edad: 5,
      };

      const result = await service.update(
        '1',
        dto,
      );

      expect(pet.nombre).toBe(
        'Noah actualizado',
      );

      expect(pet.edad).toBe(5);

      expect(
        petsRepository.save,
      ).toHaveBeenCalledWith(pet);

      expect(result).toEqual(pet);
    });

    it('debe cambiar el dueño correctamente', async () => {
      const oldOwner = {
        id: '1',
      } as unknown as Owner;

      const newOwner = {
        id: '2',
      } as unknown as Owner;

      const pet = {
        id: '1',
        nombre: 'Noah',
        especie: 'Perro',
        raza: 'Golden Retriever',
        edad: 4,
        ownerId: '1',
        owner: oldOwner,
      } as unknown as Pet;

      petsRepository.findOne.mockResolvedValue(pet);

      ownersRepository.findOne.mockResolvedValue(
        newOwner,
      );

      petsRepository.save.mockResolvedValue(pet);

      await service.update('1', {
        ownerId: 2,
      });

      expect(
        ownersRepository.findOne,
      ).toHaveBeenCalledWith({
        where: {
          id: '2',
        },
      });

      expect(pet.ownerId).toBe('2');

      expect(pet.owner).toBe(
        newOwner,
      );

      expect(
        petsRepository.save,
      ).toHaveBeenCalledWith(pet);
    });

    it('debe lanzar NotFoundException si el nuevo dueño no existe', async () => {
      const pet = {
        id: '1',
        nombre: 'Noah',
        especie: 'Perro',
        raza: 'Golden Retriever',
        edad: 4,
        ownerId: '1',
      } as unknown as Pet;

      petsRepository.findOne.mockResolvedValue(pet);

      ownersRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update('1', {
          ownerId: 999,
        }),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.update('1', {
          ownerId: 999,
        }),
      ).rejects.toThrow(
        'Dueño con ID 999 no encontrado',
      );

      expect(
        petsRepository.save,
      ).not.toHaveBeenCalled();
    });

    it('debe lanzar NotFoundException si la mascota no existe al actualizar', async () => {
      petsRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update('999', {
          nombre: 'Nueva mascota',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(
        ownersRepository.findOne,
      ).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('debe eliminar una mascota correctamente', async () => {
      const pet = {
        id: '1',
        nombre: 'Noah',
      } as unknown as Pet;

      petsRepository.findOne.mockResolvedValue(pet);

      petsRepository.remove.mockResolvedValue(
        pet,
      );

      await service.remove('1');

      expect(
        petsRepository.findOne,
      ).toHaveBeenCalledWith({
        where: {
          id: '1',
        },
        relations: ['owner'],
      });

      expect(
        petsRepository.remove,
      ).toHaveBeenCalledWith(pet);
    });

    it('debe lanzar NotFoundException si la mascota no existe al eliminar', async () => {
      petsRepository.findOne.mockResolvedValue(null);

      await expect(
        service.remove('999'),
      ).rejects.toThrow(NotFoundException);

      expect(
        petsRepository.remove,
      ).not.toHaveBeenCalled();
    });
  });
});