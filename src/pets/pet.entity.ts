import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Owner } from '../owners/owner.entity';
import { Appointment } from '../appointments/appointment.entity';

@Entity('pets')
export class Pet {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  nombre!: string;

  @Column({ type: 'varchar', length: 50 })
  especie!: string;

  @Column({ type: 'varchar', length: 100 })
  raza!: string;

  @Column({ type: 'integer' })
  edad!: number;

  @Column({ name: 'owner_id', type: 'bigint' })
  ownerId!: string;

  @ManyToOne(() => Owner, (owner) => owner.pets, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'owner_id' })
  owner!: Owner;

  @OneToMany(() => Appointment, (appointment) => appointment.pet)
  appointments!: Appointment[];
}