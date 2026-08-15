import { Test, TestingModule } from '@nestjs/testing';

import { OwnersController } from './owners.controller';
import { OwnersService } from './owners.service';

describe('OwnersController', () => {
  let controller: OwnersController;
  let service: jest.Mocked<OwnersService>;

  beforeEach(async () => {
    const mockOwnersService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule =
      await Test.createTestingModule({
        controllers: [OwnersController],
        providers: [
          {
            provide: OwnersService,
            useValue: mockOwnersService,
          },
        ],
      }).compile();

    controller =
      module.get<OwnersController>(OwnersController);

    service = module.get<OwnersService>(
      OwnersService,
    ) as jest.Mocked<OwnersService>;
  });

  it('debe estar definido', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('debe crear un dueño correctamente', async () => {
      const dto = {
        nombre: 'Guillermo',
        apellido: 'Duque',
        telefono: '3115555555',
        email: 'guillermo@example.com',
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
    it('debe devolver todos los dueños', async () => {
      const resultado = [
        {
          id: '1',
          nombre: 'Guillermo',
          apellido: 'Duque',
        },
      ];

      service.findAll.mockResolvedValue(resultado as any);

      expect(
        await controller.findAll(),
      ).toEqual(resultado);

      expect(service.findAll).toHaveBeenCalledWith();
    });
  });

  describe('findOne', () => {
    it('debe encontrar un dueño por ID', async () => {
      const resultado = {
        id: '1',
        nombre: 'Guillermo',
        apellido: 'Duque',
      };

      service.findOne.mockResolvedValue(resultado as any);

      expect(
        await controller.findOne('1'),
      ).toEqual(resultado);

      expect(service.findOne).toHaveBeenCalledWith('1');
    });
  });

  describe('update', () => {
    it('debe actualizar un dueño correctamente', async () => {
      const dto = {
        telefono: '3001234567',
      };

      const resultado = {
        id: '1',
        nombre: 'Guillermo',
        apellido: 'Duque',
        telefono: '3001234567',
      };

      service.update.mockResolvedValue(resultado as any);

      expect(
        await controller.update('1', dto),
      ).toEqual(resultado);

      expect(service.update).toHaveBeenCalledWith(
        '1',
        dto,
      );
    });
  });

  describe('remove', () => {
    it('debe eliminar un dueño correctamente', async () => {
      service.remove.mockResolvedValue(undefined);

      expect(
        await controller.remove('1'),
      ).toBeUndefined();

      expect(service.remove).toHaveBeenCalledWith('1');
    });
  });
});