import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Owner } from '../owners/owner.entity';
import { Appointment } from '../appointments/appointment.entity';

@Entity({ name: 'pets' })
export class Pet {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  nombre: string;

  @Column({ length: 50 })
  especie: string;

  @Column({ length: 100 })
  raza: string;

  @Column({ type: 'int' })
  edad: number;

  @ManyToOne(() => Owner, (owner) => owner.pets, {
    nullable: false,
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'owner_id' })
  owner: Owner;

  @OneToMany(() => Appointment, (appointment) => appointment.pet)
  appointments: Appointment[];
}
