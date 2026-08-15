import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AppointmentsService } from './appointments.service';
import { Appointment } from './appointment.entity';
import { Pet } from '../pets/pet.entity';
import { AppointmentStatus } from './appointment.entity';

describe('AppointmentsService', () => {
  let service: AppointmentsService;
  let appointmentsRepository: jest.Mocked<Repository<Appointment>>;
  let petsRepository: jest.Mocked<Repository<Pet>>;

  beforeEach(async () => {
    const module: TestingModule =
      await Test.createTestingModule({
        providers: [
          AppointmentsService,
          {
            provide: getRepositoryToken(Appointment),
            useValue: {
              create: jest.fn(),
              save: jest.fn(),
              find: jest.fn(),
              findOne: jest.fn(),
              remove: jest.fn(),
              createQueryBuilder: jest.fn(),
            },
          },
          {
            provide: getRepositoryToken(Pet),
            useValue: {
              findOne: jest.fn(),
            },
          },
        ],
      }).compile();

    service =
      module.get<AppointmentsService>(
        AppointmentsService,
      );

    appointmentsRepository =
      module.get(
        getRepositoryToken(Appointment),
      );

    petsRepository =
      module.get(
        getRepositoryToken(Pet),
      );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });


  describe('create', () => {
    it('debe crear una cita correctamente', async () => {
      const pet = {
        id: '1',
        nombre: 'Max',
      } as Pet;

      const dto = {
        fecha: '2026-08-20T10:00:00.000Z',
        motivo: 'Consulta general',
        estado: AppointmentStatus.SCHEDULED,
        petId: '1',
      };

      const appointment = {
        id: '1',
        fecha: new Date(dto.fecha),
        motivo: dto.motivo,
        estado: dto.estado,
        petId: '1',
        pet,
      } as Appointment;

      petsRepository.findOne.mockResolvedValue(pet);

      appointmentsRepository.create.mockReturnValue(
        appointment,
      );

      appointmentsRepository.save.mockResolvedValue(
        appointment,
      );

      appointmentsRepository.findOne.mockResolvedValue(
        appointment,
      );

      const result = await service.create(dto);

      expect(result).toEqual(appointment);

      expect(petsRepository.findOne).toHaveBeenCalledWith({
        where: {
          id: '1',
        },
      });

      expect(
        appointmentsRepository.create,
      ).toHaveBeenCalled();

      expect(
        appointmentsRepository.save,
      ).toHaveBeenCalledWith(appointment);
    });

    it('debe lanzar NotFoundException si la mascota no existe', async () => {
      const dto = {
        fecha: '2026-08-20T10:00:00.000Z',
        motivo: 'Consulta general',
        estado: AppointmentStatus.SCHEDULED,
        petId: '999',
      };

      petsRepository.findOne.mockResolvedValue(
        null,
      );

      await expect(
        service.create(dto),
      ).rejects.toThrow(NotFoundException);

      expect(
        appointmentsRepository.create,
      ).not.toHaveBeenCalled();

      expect(
        appointmentsRepository.save,
      ).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('debe devolver todas las citas', async () => {
      const appointments = [
        {
          id: '1',
          motivo: 'Consulta',
        },
        {
          id: '2',
          motivo: 'Vacunación',
        },
      ] as Appointment[];

      appointmentsRepository.find.mockResolvedValue(
        appointments,
      );

      const result = await service.findAll();

      expect(result).toEqual(appointments);

      expect(
        appointmentsRepository.find,
      ).toHaveBeenCalledWith({
        relations: ['pet'],
      });
    });

    it('debe filtrar citas por fecha', async () => {
      const appointments = [
        {
          id: '1',
          motivo: 'Consulta',
        },
      ] as Appointment[];

      const getMany = jest
        .fn()
        .mockResolvedValue(appointments);

      const andWhere = jest.fn().mockReturnValue({
        getMany,
      });

      const where = jest.fn().mockReturnValue({
        andWhere,
      });

      const leftJoinAndSelect = jest
        .fn()
        .mockReturnValue({
          where,
        });

      const createQueryBuilder =
        jest.fn().mockReturnValue({
          leftJoinAndSelect,
        });

      appointmentsRepository.createQueryBuilder =
        createQueryBuilder;

      const result = await service.findAll(
        '2026-08-20',
      );

      expect(result).toEqual(appointments);

      expect(
        createQueryBuilder,
      ).toHaveBeenCalledWith('appointment');

      expect(
        leftJoinAndSelect,
      ).toHaveBeenCalledWith(
        'appointment.pet',
        'pet',
      );

      expect(where).toHaveBeenCalled();

      expect(andWhere).toHaveBeenCalled();

      expect(getMany).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('debe encontrar una cita por ID', async () => {
      const appointment = {
        id: '1',
        motivo: 'Consulta',
      } as Appointment;

      appointmentsRepository.findOne.mockResolvedValue(
        appointment,
      );

      const result = await service.findOne('1');

      expect(result).toEqual(appointment);

      expect(
        appointmentsRepository.findOne,
      ).toHaveBeenCalledWith({
        where: {
          id: '1',
        },
        relations: ['pet'],
      });
    });

    it('debe lanzar NotFoundException si la cita no existe', async () => {
      appointmentsRepository.findOne.mockResolvedValue(
        null,
      );

      await expect(
        service.findOne('999'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('debe actualizar una cita correctamente', async () => {
      const appointment = {
        id: '1',
        fecha: new Date(
          '2026-08-20T10:00:00.000Z',
        ),
        motivo: 'Consulta',
        estado: AppointmentStatus.SCHEDULED,
        petId: '1',
      } as Appointment;

      const updatedAppointment = {
        ...appointment,
        motivo: 'Consulta de seguimiento',
      } as Appointment;

      appointmentsRepository.findOne
        .mockResolvedValueOnce(appointment)
        .mockResolvedValueOnce(updatedAppointment);

      appointmentsRepository.save.mockResolvedValue(
        updatedAppointment,
      );

      const result = await service.update('1', {
        motivo: 'Consulta de seguimiento',
      });

      expect(result).toEqual(
        updatedAppointment,
      );

      expect(
        appointmentsRepository.save,
      ).toHaveBeenCalledWith(appointment);
    });

    it('debe actualizar la fecha correctamente', async () => {
      const appointment = {
        id: '1',
        fecha: new Date(
          '2026-08-20T10:00:00.000Z',
        ),
        motivo: 'Consulta',
        estado: AppointmentStatus.SCHEDULED,
        petId: '1',
      } as Appointment;

      appointmentsRepository.findOne
        .mockResolvedValueOnce(appointment)
        .mockResolvedValueOnce(appointment);

      appointmentsRepository.save.mockResolvedValue(
        appointment,
      );

      const nuevaFecha =
        '2026-08-25T14:00:00.000Z';

      await service.update('1', {
        fecha: nuevaFecha,
      });

      expect(appointment.fecha).toEqual(
        new Date(nuevaFecha),
      );
    });

    it('debe actualizar el estado correctamente', async () => {
      const appointment = {
        id: '1',
        fecha: new Date(
          '2026-08-20T10:00:00.000Z',
        ),
        motivo: 'Consulta',
        estado: AppointmentStatus.SCHEDULED,
        petId: '1',
      } as Appointment;

      appointmentsRepository.findOne
        .mockResolvedValueOnce(appointment)
        .mockResolvedValueOnce(appointment);

      appointmentsRepository.save.mockResolvedValue(
        appointment,
      );

      await service.update('1', {
        estado: AppointmentStatus.COMPLETED,
      });

      expect(appointment.estado).toBe(
        AppointmentStatus.COMPLETED,
      );
    });

    it('debe cambiar la mascota de una cita correctamente', async () => {
      const appointment = {
        id: '1',
        fecha: new Date(
          '2026-08-20T10:00:00.000Z',
        ),
        motivo: 'Consulta',
        estado: AppointmentStatus.SCHEDULED,
        petId: '1',
      } as Appointment;

      const newPet = {
        id: '2',
        nombre: 'Luna',
      } as Pet;

      appointmentsRepository.findOne
        .mockResolvedValueOnce(appointment)
        .mockResolvedValueOnce(appointment);

      petsRepository.findOne.mockResolvedValue(
        newPet,
      );

      appointmentsRepository.save.mockResolvedValue(
        appointment,
      );

      await service.update('1', {
        petId: '2',
      });

      expect(appointment.petId).toBe('2');

      expect(appointment.pet).toBe(
        newPet,
      );

      expect(
        petsRepository.findOne,
      ).toHaveBeenCalledWith({
        where: {
          id: '2',
        },
      });
    });

    it('debe lanzar NotFoundException al actualizar una cita inexistente', async () => {
      appointmentsRepository.findOne.mockResolvedValue(
        null,
      );

      await expect(
        service.update('999', {
          motivo: 'Nueva consulta',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('debe lanzar NotFoundException si la nueva mascota no existe', async () => {
      const appointment = {
        id: '1',
        fecha: new Date(
          '2026-08-20T10:00:00.000Z',
        ),
        motivo: 'Consulta',
        estado: AppointmentStatus.SCHEDULED,
        petId: '1',
      } as Appointment;

      appointmentsRepository.findOne.mockResolvedValue(
        appointment,
      );

      petsRepository.findOne.mockResolvedValue(
        null,
      );

      await expect(
        service.update('1', {
          petId: '999',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('validateStatusChange', () => {
    it('debe impedir cambiar una cita completada a otro estado', async () => {
      const appointment = {
        id: '1',
        fecha: new Date(
          '2026-08-20T10:00:00.000Z',
        ),
        motivo: 'Consulta',
        estado: AppointmentStatus.COMPLETED,
        petId: '1',
      } as Appointment;

      appointmentsRepository.findOne.mockResolvedValue(
        appointment,
      );

      await expect(
        service.update('1', {
          estado: AppointmentStatus.SCHEDULED,
        }),
      ).rejects.toThrow(ConflictException);

      expect(
        appointmentsRepository.save,
      ).not.toHaveBeenCalled();
    });

    it('debe impedir cambiar una cita cancelada a otro estado', async () => {
      const appointment = {
        id: '1',
        fecha: new Date(
          '2026-08-20T10:00:00.000Z',
        ),
        motivo: 'Consulta',
        estado: AppointmentStatus.CANCELLED,
        petId: '1',
      } as Appointment;

      appointmentsRepository.findOne.mockResolvedValue(
        appointment,
      );

      await expect(
        service.update('1', {
          estado: AppointmentStatus.SCHEDULED,
        }),
      ).rejects.toThrow(ConflictException);

      expect(
        appointmentsRepository.save,
      ).not.toHaveBeenCalled();
    });

    it('debe permitir mantener una cita completada como completada', async () => {
      const appointment = {
        id: '1',
        fecha: new Date(
          '2026-08-20T10:00:00.000Z',
        ),
        motivo: 'Consulta',
        estado: AppointmentStatus.COMPLETED,
        petId: '1',
      } as Appointment;

      appointmentsRepository.findOne
        .mockResolvedValueOnce(appointment)
        .mockResolvedValueOnce(appointment);

      appointmentsRepository.save.mockResolvedValue(
        appointment,
      );

      await expect(
        service.update('1', {
          estado: AppointmentStatus.COMPLETED,
        }),
      ).resolves.toEqual(appointment);
    });
  });

  describe('remove', () => {
    it('debe eliminar una cita correctamente', async () => {
      const appointment = {
        id: '1',
        motivo: 'Consulta',
      } as Appointment;

      appointmentsRepository.findOne.mockResolvedValue(
        appointment,
      );

      appointmentsRepository.remove.mockResolvedValue(
        appointment,
      );

      await expect(
        service.remove('1'),
      ).resolves.toBeUndefined();

      expect(
        appointmentsRepository.remove,
      ).toHaveBeenCalledWith(appointment);
    });

    it('debe lanzar NotFoundException al eliminar una cita inexistente', async () => {
      appointmentsRepository.findOne.mockResolvedValue(
        null,
      );

      await expect(
        service.remove('999'),
      ).rejects.toThrow(NotFoundException);

      expect(
        appointmentsRepository.remove,
      ).not.toHaveBeenCalled();
    });
  });
});