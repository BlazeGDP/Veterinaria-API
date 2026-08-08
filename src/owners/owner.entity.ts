import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Pet } from '../pets/pet.entity';

@Entity({ name: 'owners' })
export class Owner {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  nombre: string;

  @Column({ length: 100 })
  apellido: string;

  @Column({ length: 20 })
  telefono: string;

  @Column({ length: 255, unique: true })
  email: string;

  @OneToMany(() => Pet, (pet) => pet.owner)
  pets: Pet[];
}
