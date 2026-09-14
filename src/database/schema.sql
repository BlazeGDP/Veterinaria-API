-- ============================================================
-- API RESTful Veterinaria - V2
-- Base de datos: PostgreSQL
--
-- Esquema utilizado:
--   schema_production -> Ambiente de Producción
--
-- Entidades:
--   owners
--   pets
--   appointments
--
-- Relaciones:
--   Owner 1 ---- N Pets
--   Pet   1 ---- N Appointments
-- ============================================================


-- ============================================================
-- 1. CREACIÓN DEL ESQUEMA
-- ============================================================

CREATE SCHEMA IF NOT EXISTS schema_production;


-- ============================================================
-- 2. TABLA: owners
-- ============================================================

CREATE TABLE IF NOT EXISTS schema_production.owners (
    id BIGSERIAL PRIMARY KEY,

    nombre VARCHAR(100) NOT NULL,

    apellido VARCHAR(100) NOT NULL,

    telefono VARCHAR(20) NOT NULL,

    email VARCHAR(255) NOT NULL UNIQUE
);


-- ============================================================
-- 3. TABLA: pets
-- ============================================================

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


-- Índice para buscar mascotas pertenecientes a un dueño.
CREATE INDEX IF NOT EXISTS idx_production_pets_owner_id
    ON schema_production.pets (owner_id);


-- Índice para buscar mascotas por especie.
CREATE INDEX IF NOT EXISTS idx_production_pets_especie
    ON schema_production.pets (especie);


-- ============================================================
-- 4. TABLA: appointments
-- ============================================================

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


-- Índice para buscar citas de una mascota.
CREATE INDEX IF NOT EXISTS idx_production_appointments_pet_id
    ON schema_production.appointments (pet_id);


-- Índice para buscar citas por fecha.
CREATE INDEX IF NOT EXISTS idx_production_appointments_fecha
    ON schema_production.appointments (fecha);