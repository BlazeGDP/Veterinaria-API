-- ============================================================
-- API RESTful Veterinaria
-- Base de datos: PostgreSQL 16
--
-- Se utiliza una única base de datos con dos esquemas
-- independientes:
--
--   schema_testing     -> Ambiente de Testing
--   schema_production  -> Ambiente de Producción
--
-- Entidades:
--   owners
--   pets
--   appointments
--
-- Relaciones:
--   Owner 1 ---- N Pets
--   Pet   1 ---- N Appointments
--
-- Consultas principales:
--   1. Buscar mascotas por especie
--   2. Buscar citas por fecha
--   3. Buscar mascotas de un dueño
-- ============================================================


-- ============================================================
-- 1. CREACIÓN DE ESQUEMAS
-- ============================================================

CREATE SCHEMA IF NOT EXISTS schema_testing;

CREATE SCHEMA IF NOT EXISTS schema_production;


-- ============================================================
-- 2. SCHEMA TESTING
-- ============================================================

-- ------------------------------------------------------------
-- 2.1 Tabla: owners
-- Representa a los dueños de las mascotas.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS schema_testing.owners (
    id BIGSERIAL PRIMARY KEY,

    nombre VARCHAR(100) NOT NULL,

    apellido VARCHAR(100) NOT NULL,

    telefono VARCHAR(20) NOT NULL,

    email VARCHAR(255) NOT NULL UNIQUE
);


-- ------------------------------------------------------------
-- 2.2 Tabla: pets
-- Representa a las mascotas de la veterinaria.
--
-- Relación:
-- pets.owner_id -> owners.id
-- ------------------------------------------------------------

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


-- Índice para:
-- Buscar mascotas pertenecientes a un dueño.
CREATE INDEX IF NOT EXISTS idx_testing_pets_owner_id
    ON schema_testing.pets (owner_id);


-- Índice para:
-- Buscar mascotas por especie.
CREATE INDEX IF NOT EXISTS idx_testing_pets_especie
    ON schema_testing.pets (especie);


-- ------------------------------------------------------------
-- 2.3 Tabla: appointments
-- Representa las citas veterinarias.
--
-- Relación:
-- appointments.pet_id -> pets.id
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS schema_testing.appointments (
    id BIGSERIAL PRIMARY KEY,

    fecha TIMESTAMPTZ NOT NULL,

    motivo TEXT NOT NULL,

    estado VARCHAR(20) NOT NULL DEFAULT 'scheduled',

    pet_id BIGINT NOT NULL,

    CONSTRAINT chk_testing_appointment_estado
        CHECK (
            estado IN (
                'scheduled',
                'completed',
                'cancelled'
            )
        ),

    CONSTRAINT fk_testing_appointments_pet
        FOREIGN KEY (pet_id)
        REFERENCES schema_testing.pets (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);


-- Índice para:
-- Buscar citas de una mascota.
CREATE INDEX IF NOT EXISTS idx_testing_appointments_pet_id
    ON schema_testing.appointments (pet_id);


-- Índice para:
-- Buscar citas por fecha.
CREATE INDEX IF NOT EXISTS idx_testing_appointments_fecha
    ON schema_testing.appointments (fecha);


-- ============================================================
-- 3. SCHEMA PRODUCTION
-- ============================================================

-- ------------------------------------------------------------
-- 3.1 Tabla: owners
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS schema_production.owners (
    id BIGSERIAL PRIMARY KEY,

    nombre VARCHAR(100) NOT NULL,

    apellido VARCHAR(100) NOT NULL,

    telefono VARCHAR(20) NOT NULL,

    email VARCHAR(255) NOT NULL UNIQUE
);


-- ------------------------------------------------------------
-- 3.2 Tabla: pets
-- ------------------------------------------------------------

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


-- Índice para:
-- Buscar mascotas pertenecientes a un dueño.
CREATE INDEX IF NOT EXISTS idx_production_pets_owner_id
    ON schema_production.pets (owner_id);


-- Índice para:
-- Buscar mascotas por especie.
CREATE INDEX IF NOT EXISTS idx_production_pets_especie
    ON schema_production.pets (especie);


-- ------------------------------------------------------------
-- 3.3 Tabla: appointments
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS schema_production.appointments (
    id BIGSERIAL PRIMARY KEY,

    fecha TIMESTAMPTZ NOT NULL,

    motivo TEXT NOT NULL,

    estado VARCHAR(20) NOT NULL DEFAULT 'scheduled',

    pet_id BIGINT NOT NULL,

    CONSTRAINT chk_production_appointment_estado
        CHECK (
            estado IN (
                'scheduled',
                'completed',
                'cancelled'
            )
        ),

    CONSTRAINT fk_production_appointments_pet
        FOREIGN KEY (pet_id)
        REFERENCES schema_production.pets (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);


-- Índice para:
-- Buscar citas de una mascota.
CREATE INDEX IF NOT EXISTS idx_production_appointments_pet_id
    ON schema_production.appointments (pet_id);


-- Índice para:
-- Buscar citas por fecha.
CREATE INDEX IF NOT EXISTS idx_production_appointments_fecha
    ON schema_production.appointments (fecha);


-- ============================================================
-- 4. CONFIGURACIÓN DE SEARCH PATH
-- ============================================================
--
-- NO se establece un search_path global aquí.
--
-- La aplicación NestJS/TypeORM determinará el esquema utilizado
-- mediante la variable de entorno DATABASE_SCHEMA.
--
-- Ejemplo:
--
-- Testing:
-- DATABASE_SCHEMA=schema_testing
--
-- Producción:
-- DATABASE_SCHEMA=schema_production
--
-- ============================================================
