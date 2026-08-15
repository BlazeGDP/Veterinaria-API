import { Test, TestingModule } from '@nestjs/testing';
import { HttpAdapterHost } from '@nestjs/core';

import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';

describe('AppointmentsController', () => {
  let controller: AppointmentsController;
  let service: jest.Mocked<AppointmentsService>;

  const mockFastify = {
    route: jest.fn(),
  };

  beforeEach(async () => {
    const mockAppointmentsService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const mockHttpAdapterHost = {
      httpAdapter: {
        getInstance: jest.fn().mockReturnValue(mockFastify),
      },
    };

    const module: TestingModule =
      await Test.createTestingModule({
        controllers: [AppointmentsController],
        providers: [
          {
            provide: AppointmentsService,
            useValue: mockAppointmentsService,
          },
          {
            provide: HttpAdapterHost,
            useValue: mockHttpAdapterHost,
          },
        ],
      }).compile();

    controller =
      module.get<AppointmentsController>(
        AppointmentsController,
      );

    service =
      module.get<AppointmentsService>(
        AppointmentsService,
      ) as jest.Mocked<AppointmentsService>;

    mockFastify.route.mockClear();
  });

  describe('onModuleInit', () => {
    it('debe registrar el método HTTP QUERY', () => {
      controller.onModuleInit();

      expect(mockFastify.route).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'QUERY',
          url: '/appointments',
        }),
      );
    });

    it('debe ejecutar el servicio cuando se utiliza QUERY', async () => {
      service.findAll.mockResolvedValue([
        {
          id: '1',
          fecha: new Date('2026-08-15T10:00:00'),
          motivo: 'Consulta general',
        },
      ] as any);

      controller.onModuleInit();

      const routeConfig =
        mockFastify.route.mock.calls[0][0];

      const request = {
        body: {
          fecha: '2026-08-15',
        },
      };

      const resultado =
        await routeConfig.handler(request);

      expect(resultado).toEqual([
        {
          id: '1',
          fecha: new Date('2026-08-15T10:00:00'),
          motivo: 'Consulta general',
        },
      ]);

      expect(service.findAll).toHaveBeenCalledWith(
        '2026-08-15',
      );
    });

    it('debe ejecutar QUERY sin fecha', async () => {
      service.findAll.mockResolvedValue([]);

      controller.onModuleInit();

      const routeConfig =
        mockFastify.route.mock.calls[0][0];

      const request = {
        body: {},
      };

      const resultado =
        await routeConfig.handler(request);

      expect(resultado).toEqual([]);

      expect(service.findAll).toHaveBeenCalledWith(
        undefined,
      );
    });
  });

  describe('create', () => {
    it('debe crear una cita correctamente', async () => {
      const dto = {
        fecha: '2026-08-15T10:00:00',
        motivo: 'Consulta general',
        petId: '1',
      };

      const resultado = {
        id: '1',
        ...dto,
      };

      service.create.mockResolvedValue(resultado as any);

      expect(
        await controller.create(dto as any),
      ).toEqual(resultado);

      expect(service.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('findAll', () => {
    it('debe devolver todas las citas', async () => {
      const resultado = [
        {
          id: '1',
          motivo: 'Consulta general',
        },
      ];

      service.findAll.mockResolvedValue(resultado as any);

      expect(
        await controller.findAll(),
      ).toEqual(resultado);

      expect(service.findAll).toHaveBeenCalledWith(
        undefined,
      );
    });

    it('debe filtrar las citas por fecha', async () => {
      const resultado = [
        {
          id: '1',
          motivo: 'Consulta general',
        },
      ];

      service.findAll.mockResolvedValue(resultado as any);

      expect(
        await controller.findAll('2026-08-15'),
      ).toEqual(resultado);

      expect(service.findAll).toHaveBeenCalledWith(
        '2026-08-15',
      );
    });
  });

  describe('findOne', () => {
    it('debe encontrar una cita por ID', async () => {
      const resultado = {
        id: '1',
        motivo: 'Consulta general',
      };

      service.findOne.mockResolvedValue(resultado as any);

      expect(
        await controller.findOne(1),
      ).toEqual(resultado);

      expect(service.findOne).toHaveBeenCalledWith('1');
    });
  });

  describe('update', () => {
    it('debe actualizar una cita correctamente', async () => {
      const dto = {
        motivo: 'Vacunación',
      };

      const resultado = {
        id: '1',
        motivo: 'Vacunación',
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
    it('debe eliminar una cita correctamente', async () => {
      service.remove.mockResolvedValue(undefined);

      expect(
        await controller.remove(1),
      ).toBeUndefined();

      expect(service.remove).toHaveBeenCalledWith('1');
    });
  });
});