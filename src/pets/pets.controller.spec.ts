import { Test, TestingModule } from '@nestjs/testing';

import { PetsController } from './pets.controller';
import { PetsService } from './pets.service';

describe('PetsController', () => {
  let controller: PetsController;
  let service: jest.Mocked<PetsService>;

  beforeEach(async () => {
    const mockPetsService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule =
      await Test.createTestingModule({
        controllers: [PetsController],
        providers: [
          {
            provide: PetsService,
            useValue: mockPetsService,
          },
        ],
      }).compile();

    controller =
      module.get<PetsController>(PetsController);

    service =
      module.get<PetsService>(
        PetsService,
      ) as jest.Mocked<PetsService>;
  });

  it('debe estar definido', () => {
    expect(controller).toBeDefined();
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

      const resultado = {
        id: '1',
        ...dto,
      };

      service.create.mockResolvedValue(resultado as any);

      expect(
        await controller.create(dto),
      ).toEqual(resultado);

      expect(service.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('findAll', () => {
    it('debe devolver todas las mascotas', async () => {
      const resultado = [
        {
          id: '1',
          nombre: 'Noah',
          especie: 'Perro',
        },
      ];

      service.findAll.mockResolvedValue(resultado as any);

      expect(
        await controller.findAll(),
      ).toEqual(resultado);

      expect(service.findAll).toHaveBeenCalledWith(
        undefined,
        undefined,
      );
    });

    it('debe filtrar por especie', async () => {
      const resultado = [
        {
          id: '1',
          nombre: 'Noah',
          especie: 'Perro',
        },
      ];

      service.findAll.mockResolvedValue(resultado as any);

      expect(
        await controller.findAll('Perro'),
      ).toEqual(resultado);

      expect(service.findAll).toHaveBeenCalledWith(
        'Perro',
        undefined,
      );
    });

    it('debe filtrar por ownerId', async () => {
      const resultado = [
        {
          id: '1',
          nombre: 'Noah',
          especie: 'Perro',
          ownerId: '1',
        },
      ];

      service.findAll.mockResolvedValue(resultado as any);

      expect(
        await controller.findAll(
          undefined,
          '1',
        ),
      ).toEqual(resultado);

      expect(service.findAll).toHaveBeenCalledWith(
        undefined,
        '1',
      );
    });

    it('debe filtrar por especie y ownerId', async () => {
      const resultado = [
        {
          id: '1',
          nombre: 'Noah',
          especie: 'Perro',
          ownerId: '1',
        },
      ];

      service.findAll.mockResolvedValue(resultado as any);

      expect(
        await controller.findAll(
          'Perro',
          '1',
        ),
      ).toEqual(resultado);

      expect(service.findAll).toHaveBeenCalledWith(
        'Perro',
        '1',
      );
    });
  });

  describe('findOne', () => {
    it('debe encontrar una mascota por ID', async () => {
      const resultado = {
        id: '1',
        nombre: 'Noah',
        especie: 'Perro',
      };

      service.findOne.mockResolvedValue(resultado as any);

      expect(
        await controller.findOne(1),
      ).toEqual(resultado);

      expect(service.findOne).toHaveBeenCalledWith(
        '1',
      );
    });
  });

  describe('update', () => {
    it('debe actualizar una mascota correctamente', async () => {
      const dto = {
        nombre: 'Noah actualizado',
      };

      const resultado = {
        id: '1',
        nombre: 'Noah actualizado',
      };

      service.update.mockResolvedValue(resultado as any);

      expect(
        await controller.update(1, dto),
      ).toEqual(resultado);

      expect(service.update).toHaveBeenCalledWith(
        '1',
        dto,
      );
    });
  });

  describe('remove', () => {
    it('debe eliminar una mascota correctamente', async () => {
      service.remove.mockResolvedValue(undefined);

      expect(
        await controller.remove(1),
      ).toBeUndefined();

      expect(service.remove).toHaveBeenCalledWith(
        '1',
      );
    });
  });
});