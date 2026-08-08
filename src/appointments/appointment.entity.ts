import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Pet } from '../pets/pet.entity';

export enum AppointmentStatus {
  SCHEDULED = 'scheduled',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity('appointments')
export class Appointment {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'timestamptz' })
  fecha!: Date;

  @Column({ type: 'text' })
  motivo!: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: AppointmentStatus.SCHEDULED,
  })
  estado!: AppointmentStatus;

  @Column({ name: 'pet_id', type: 'bigint' })
  petId!: string;

  @ManyToOne(() => Pet, (pet) => pet.appointments, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'pet_id' })
  pet!: Pet;
}
