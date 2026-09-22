import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import databaseConfig from './config/database.config';

import { OwnersModule } from './owners/owners.module';
import { PetsModule } from './pets/pets.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { HealthModule } from './health/health.module';
import { SqsModule } from './sqs/sqs.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig],
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],

      useFactory: (configService: ConfigService) =>
        configService.getOrThrow('database'),
    }),

    OwnersModule,
    PetsModule,
    AppointmentsModule,
    HealthModule,
    SqsModule,
  ],
})
export class AppModule {}
