import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

import { Owner } from '../owners/owner.entity';
import { Pet } from '../pets/pet.entity';
import { Appointment } from '../appointments/appointment.entity';

export default registerAs(
  'database',
  (): TypeOrmModuleOptions => ({
    type: 'postgres',

    host: process.env.DATABASE_HOST || 'localhost',

    port: Number(process.env.DATABASE_PORT || 5432),

    username: process.env.DATABASE_USER,

    password: process.env.DATABASE_PASSWORD,

    database: process.env.DATABASE_NAME,

    schema: process.env.DATABASE_SCHEMA,

    entities: [Owner, Pet, Appointment],

    synchronize: false,

    logging: false,

    migrationsRun: false,
  }),
);