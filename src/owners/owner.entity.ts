import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Pet } from '../pets/pet.entity';

@Entity('owners')
export class Owner {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({
    type: 'varchar',
    length: 100,
  })
  nombre!: string;

  @Column({
    type: 'varchar',
    length: 100,
  })
  apellido!: string;

  @Column({
    type: 'varchar',
    length: 20,
  })
  telefono!: string;

  @Column({
    type: 'varchar',
    length: 255,
    unique: true,
  })
  email!: string;

  @OneToMany(() => Pet, (pet) => pet.owner)
  pets!: Pet[];
}
