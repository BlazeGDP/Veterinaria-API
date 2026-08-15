import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { OwnersService } from './owners.service';
import { Owner } from './owner.entity';

describe('OwnersService', () => {
  let service: OwnersService;
  let repository: jest.Mocked<Repository<Owner>>;

  beforeEach(async () => {
    const mockRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule =
      await Test.createTestingModule({
        providers: [
          OwnersService,
          {
            provide: getRepositoryToken(Owner),
            useValue: mockRepository,
          },
        ],
      }).compile();

    service = module.get<OwnersService>(OwnersService);
    repository = module.get(
      getRepositoryToken(Owner),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('debe crear un dueño correctamente', async () => {
      const createOwnerDto = {
        nombre: 'Juan',
        apellido: 'Pérez',
        telefono: '3001234567',
        email: 'juan@example.com',
      };

      const owner = {
        id: '1',
        ...createOwnerDto,
        pets: [],
      } as Owner;

      repository.findOne.mockResolvedValue(null);
      repository.create.mockReturnValue(owner);
      repository.save.mockResolvedValue(owner);

      const result = await service.create(createOwnerDto);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: {
          email: createOwnerDto.email,
        },
      });

      expect(repository.create).toHaveBeenCalledWith(
        createOwnerDto,
      );

      expect(repository.save).toHaveBeenCalledWith(owner);

      expect(result).toEqual(owner);
    });

    it('debe lanzar ConflictException si el email ya existe', async () => {
      const createOwnerDto = {
        nombre: 'Juan',
        apellido: 'Pérez',
        telefono: '3001234567',
        email: 'juan@example.com',
      };

      const existingOwner = {
        id: '1',
        ...createOwnerDto,
      } as Owner;

      repository.findOne.mockResolvedValue(existingOwner);

      await expect(
        service.create(createOwnerDto),
      ).rejects.toThrow(ConflictException);

      expect(repository.create).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('debe devolver todos los dueños con sus mascotas', async () => {
      const owners = [
        {
          id: '1',
          nombre: 'Juan',
          apellido: 'Pérez',
          telefono: '3001234567',
          email: 'juan@example.com',
          pets: [],
        },
        {
          id: '2',
          nombre: 'María',
          apellido: 'Gómez',
          telefono: '3009876543',
          email: 'maria@example.com',
          pets: [],
        },
      ] as Owner[];

      repository.find.mockResolvedValue(owners);

      const result = await service.findAll();

      expect(repository.find).toHaveBeenCalledWith({
        relations: ['pets'],
      });

      expect(result).toEqual(owners);
    });
  });

  describe('findOne', () => {
    it('debe devolver un dueño por ID', async () => {
      const owner = {
        id: '1',
        nombre: 'Juan',
        apellido: 'Pérez',
        telefono: '3001234567',
        email: 'juan@example.com',
        pets: [],
      } as Owner;

      repository.findOne.mockResolvedValue(owner);

      const result = await service.findOne('1');

      expect(repository.findOne).toHaveBeenCalledWith({
        where: {
          id: '1',
        },
        relations: ['pets'],
      });

      expect(result).toEqual(owner);
    });

    it('debe lanzar NotFoundException si el dueño no existe', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.findOne('999'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('debe actualizar un dueño correctamente', async () => {
      const owner = {
        id: '1',
        nombre: 'Juan',
        apellido: 'Pérez',
        telefono: '3001234567',
        email: 'juan@example.com',
        pets: [],
      } as Owner;

      const updateOwnerDto = {
        nombre: 'Juan Carlos',
      };

      repository.findOne.mockResolvedValue(owner);
      repository.save.mockResolvedValue({
        ...owner,
        ...updateOwnerDto,
      });

      const result = await service.update(
        '1',
        updateOwnerDto,
      );

      expect(repository.save).toHaveBeenCalled();

      expect(result.nombre).toBe('Juan Carlos');
    });

    it('debe lanzar ConflictException al actualizar con un email existente', async () => {
      const owner = {
        id: '1',
        nombre: 'Juan',
        apellido: 'Pérez',
        telefono: '3001234567',
        email: 'juan@example.com',
        pets: [],
      } as Owner;

      const existingOwner = {
        id: '2',
        nombre: 'María',
        apellido: 'Gómez',
        telefono: '3009876543',
        email: 'maria@example.com',
      } as Owner;

      const updateOwnerDto = {
        email: 'maria@example.com',
      };

      repository.findOne
        .mockResolvedValueOnce(owner)
        .mockResolvedValueOnce(existingOwner);

      await expect(
        service.update('1', updateOwnerDto),
      ).rejects.toThrow(ConflictException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('debe permitir actualizar otros datos sin cambiar el email', async () => {
      const owner = {
        id: '1',
        nombre: 'Juan',
        apellido: 'Pérez',
        telefono: '3001234567',
        email: 'juan@example.com',
        pets: [],
      } as Owner;

      const updateOwnerDto = {
        telefono: '3119999999',
      };

      repository.findOne.mockResolvedValue(owner);
      repository.save.mockResolvedValue({
        ...owner,
        ...updateOwnerDto,
      });

      const result = await service.update(
        '1',
        updateOwnerDto,
      );

      expect(repository.findOne).toHaveBeenCalledTimes(1);

      expect(result.telefono).toBe('3119999999');
    });
  });

  describe('remove', () => {
    it('debe eliminar un dueño correctamente', async () => {
      const owner = {
        id: '1',
        nombre: 'Juan',
        apellido: 'Pérez',
        telefono: '3001234567',
        email: 'juan@example.com',
        pets: [],
      } as Owner;

      repository.findOne.mockResolvedValue(owner);
      repository.remove.mockResolvedValue(owner);

      await service.remove('1');

      expect(repository.findOne).toHaveBeenCalledWith({
        where: {
          id: '1',
        },
        relations: ['pets'],
      });

      expect(repository.remove).toHaveBeenCalledWith(owner);
    });

    it('debe lanzar NotFoundException al intentar eliminar un dueño inexistente', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.remove('999'),
      ).rejects.toThrow(NotFoundException);

      expect(repository.remove).not.toHaveBeenCalled();
    });
  });
});