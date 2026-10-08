-- API RESTful Veterinaria V3
-- PostgreSQL - esquema public

CREATE TABLE IF NOT EXISTS public.owners (
    id BIGSERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    telefono VARCHAR(20) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS public.pets (
    id BIGSERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    especie VARCHAR(50) NOT NULL,
    raza VARCHAR(100) NOT NULL,
    edad INTEGER NOT NULL CHECK (edad >= 0),
    owner_id BIGINT NOT NULL,
    CONSTRAINT fk_pets_owner
        FOREIGN KEY (owner_id)
        REFERENCES public.owners (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pets_owner_id
    ON public.pets (owner_id);

CREATE INDEX IF NOT EXISTS idx_pets_especie
    ON public.pets (especie);

CREATE TABLE IF NOT EXISTS public.appointments (
    id BIGSERIAL PRIMARY KEY,
    fecha TIMESTAMPTZ NOT NULL,
    motivo TEXT NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'scheduled',
    pet_id BIGINT NOT NULL,
    CONSTRAINT chk_appointment_estado
        CHECK (estado IN ('scheduled', 'completed', 'cancelled')),
    CONSTRAINT fk_appointments_pet
        FOREIGN KEY (pet_id)
        REFERENCES public.pets (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_appointments_pet_id
    ON public.appointments (pet_id);

CREATE INDEX IF NOT EXISTS idx_appointments_fecha
    ON public.appointments (fecha);