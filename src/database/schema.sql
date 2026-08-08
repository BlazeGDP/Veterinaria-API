-- Base de datos veterinaria con esquemas separados para testing y producción
-- 1. Crear la base de datos:
-- CREATE DATABASE veterinaria;

-- 2. Crear esquemas:
CREATE SCHEMA IF NOT EXISTS schema_testing;
CREATE SCHEMA IF NOT EXISTS schema_production;

-- 3. Tablas para schema_testing:
CREATE TABLE IF NOT EXISTS schema_testing.owners (
  id BIGSERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  apellido VARCHAR(100) NOT NULL,
  telefono VARCHAR(20) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS schema_testing.pets (
  id BIGSERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  especie VARCHAR(50) NOT NULL,
  raza VARCHAR(100) NOT NULL,
  edad INTEGER NOT NULL CHECK (edad >= 0),
  owner_id BIGINT NOT NULL,
  CONSTRAINT fk_testing_pets_owner
    FOREIGN KEY (owner_id)
    REFERENCES schema_testing.owners (id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_testing_pets_owner_id
  ON schema_testing.pets (owner_id);

CREATE INDEX IF NOT EXISTS idx_testing_pets_especie
  ON schema_testing.pets (especie);

CREATE TABLE IF NOT EXISTS schema_testing.appointments (
  id BIGSERIAL PRIMARY KEY,
  fecha TIMESTAMPTZ NOT NULL,
  motivo TEXT NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (estado IN ('scheduled', 'completed', 'cancelled')),
  pet_id BIGINT NOT NULL,
  CONSTRAINT fk_testing_appointments_pet
    FOREIGN KEY (pet_id)
    REFERENCES schema_testing.pets (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_testing_appointments_pet_id
  ON schema_testing.appointments (pet_id);

CREATE INDEX IF NOT EXISTS idx_testing_appointments_fecha
  ON schema_testing.appointments (fecha);

-- 4. Tablas para schema_production:
CREATE TABLE IF NOT EXISTS schema_production.owners (
  id BIGSERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  apellido VARCHAR(100) NOT NULL,
  telefono VARCHAR(20) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS schema_production.pets (
  id BIGSERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  especie VARCHAR(50) NOT NULL,
  raza VARCHAR(100) NOT NULL,
  edad INTEGER NOT NULL CHECK (edad >= 0),
  owner_id BIGINT NOT NULL,
  CONSTRAINT fk_production_pets_owner
    FOREIGN KEY (owner_id)
    REFERENCES schema_production.owners (id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_production_pets_owner_id
  ON schema_production.pets (owner_id);

CREATE INDEX IF NOT EXISTS idx_production_pets_especie
  ON schema_production.pets (especie);

CREATE TABLE IF NOT EXISTS schema_production.appointments (
  id BIGSERIAL PRIMARY KEY,
  fecha TIMESTAMPTZ NOT NULL,
  motivo TEXT NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (estado IN ('scheduled', 'completed', 'cancelled')),
  pet_id BIGINT NOT NULL,
  CONSTRAINT fk_production_appointments_pet
    FOREIGN KEY (pet_id)
    REFERENCES schema_production.pets (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_production_appointments_pet_id
  ON schema_production.appointments (pet_id);

CREATE INDEX IF NOT EXISTS idx_production_appointments_fecha
  ON schema_production.appointments (fecha);
