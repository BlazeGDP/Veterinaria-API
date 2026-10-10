# API RESTful Veterinaria — V3

API REST para gestionar una veterinaria (dueños, mascotas y citas), construida con **NestJS + Fastify + TypeORM + PostgreSQL**.
En la **versión 3** toda la infraestructura en AWS se crea y se destruye con **Terraform** y se despliega mediante un
pipeline de **GitHub Actions**.

## Resumen de la V3

- Infraestructura como código con **Terraform**, un archivo `.tf` por servicio (carpeta [`terraform/`](terraform/README.md)).
- La API corre en contenedores **Docker** sobre **Amazon ECS Fargate**, detrás de un **Application Load Balancer**.
- Base de datos **PostgreSQL en Amazon RDS**, en subnets privadas y sin acceso desde internet.
- Credenciales de la base de datos generadas por Terraform y guardadas en **AWS Secrets Manager**.
- Pipeline de despliegue (`deploy.yml`) y pipeline de eliminación (`destroy.yml`).
- Commits con **GitMoji** y versión publicada como release `v3.0.0`.

## Arquitectura

```text
                 Internet
                    │  HTTP :80
                    ▼
        ┌───────────────────────┐
        │ Application Load      │   subnets públicas (2 AZ)
        │ Balancer (ALB)        │
        └──────────┬────────────┘
                   │ :3000 (solo desde el ALB)
                   ▼
        ┌───────────────────────┐        ┌──────────────────┐
        │ ECS Fargate           │───────▶│ ECR              │  imagen Docker
        │ API NestJS            │        └──────────────────┘
        │                       │───────▶ Secrets Manager     credenciales BD
        │ subnets privadas      │───────▶ CloudWatch Logs     logs (7 días)
        └──────────┬────────────┘
                   │ :5432 (solo desde ECS, SSL)
                   ▼
        ┌───────────────────────┐
        │ RDS PostgreSQL 16     │   subnets privadas
        └───────────────────────┘

   Salida a internet de las subnets privadas: NAT Gateway (para descargar la imagen y leer secretos)
```

### Servicios de AWS utilizados

| Servicio | Uso |
|---|---|
| VPC, subnets, IGW, NAT Gateway | Red aislada con zonas públicas y privadas |
| Security Groups | Cadena ALB → ECS → RDS, cada capa solo acepta tráfico de la anterior |
| Application Load Balancer | Punto de entrada público y health check en `/health` |
| ECS Fargate | Ejecuta el contenedor de la API sin administrar servidores |
| ECR | Repositorio privado de imágenes Docker |
| RDS PostgreSQL | Base de datos relacional administrada |
| Secrets Manager | Usuario y contraseña de la base de datos |
| IAM | Rol de ejecución de las tareas ECS con permisos mínimos |
| CloudWatch Logs | Logs de la aplicación |
| S3 | Almacena el estado remoto de Terraform |

## Estructura del repositorio

```text
.
├── .github/workflows/
│   ├── deploy.yml          # Pipeline: crea infraestructura y despliega la API
│   └── destroy.yml         # Pipeline manual: elimina toda la infraestructura
├── scripts/
│   ├── bootstrap-aws.sh    # Prepara el bucket S3 del estado de Terraform
│   └── init-database.js    # Crea las tablas en PostgreSQL
├── src/
│   ├── owners/             # Dueños
│   ├── pets/               # Mascotas
│   ├── appointments/       # Citas
│   ├── health/             # GET /health
│   ├── config/             # Configuración de la base de datos
│   └── database/schema.sql # Esquema SQL
├── terraform/              # Infraestructura como código (ver terraform/README.md)
├── Dockerfile              # Imagen multi-stage (build + producción)
└── package.json
```

## Endpoints

| Recurso | Métodos | Notas |
|---|---|---|
| `/health` | `GET` | Estado del servicio (usado por el ALB) |
| `/owners` | `POST`, `GET`, `GET /:id`, `PATCH /:id`, `DELETE /:id` | Email único |
| `/pets` | `POST`, `GET`, `GET /:id`, `PATCH /:id`, `DELETE /:id` | Filtros: `?especie=` y `?ownerId=` |
| `/appointments` | `POST`, `GET`, `GET /:id`, `PATCH /:id`, `DELETE /:id` | Filtro: `?fecha=` |

### Ejemplos de cuerpo (JSON)

```json
// POST /owners
{ "nombre": "Ana", "apellido": "Ruiz", "telefono": "3001234567", "email": "ana.ruiz@mail.com" }

// POST /pets   (ownerId es numérico)
{ "nombre": "Firulais", "especie": "perro", "raza": "criollo", "edad": 3, "ownerId": 1 }

// POST /appointments   (petId es texto; estado: scheduled | completed | cancelled)
{ "fecha": "2026-10-14T10:00:00Z", "motivo": "Vacunación anual", "estado": "scheduled", "petId": "1" }
```

Las entradas se validan con `class-validator`; los campos desconocidos o inválidos responden `400`.
Relaciones: un dueño tiene varias mascotas (no se puede borrar un dueño con mascotas) y una mascota tiene varias citas
(al borrar la mascota se borran sus citas).

## Variables de entorno

| Variable | Descripción | Ejemplo |
|---|---|---|
| `PORT` | Puerto de la API | `3000` |
| `DATABASE_HOST` | Host de PostgreSQL | `localhost` |
| `DATABASE_PORT` | Puerto de PostgreSQL | `5432` |
| `DATABASE_USER` | Usuario | `postgres` |
| `DATABASE_PASSWORD` | Contraseña | — |
| `DATABASE_NAME` | Nombre de la base de datos | `veterinaria` |
| `DATABASE_SSL` | `true` para conectar con SSL (obligatorio en RDS) | `false` |

En AWS estas variables las inyecta ECS: las no sensibles desde la definición de la tarea y el usuario/contraseña
desde Secrets Manager. El archivo `.env` no se versiona.

## Ejecución local

Requisitos: Node.js 20.6 o superior y un PostgreSQL local.

```bash
npm ci
cp .env.example .env            # o crea .env con las variables de arriba
node --env-file=.env scripts/init-database.js   # crea las tablas
npm run start:dev
```

Con Docker:

```bash
docker build -t veterinaria-api .
docker run -p 3000:3000 --env-file .env veterinaria-api
```

## Despliegue en AWS

Detalle completo en [`terraform/README.md`](terraform/README.md). Resumen:

1. **Una sola vez:** crear el bucket del estado con `bash scripts/bootstrap-aws.sh <owner> <repo>` (AWS CloudShell).
2. **Secrets de GitHub** (Settings → Secrets and variables → Actions):
   `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` y, si las credenciales son temporales, `AWS_SESSION_TOKEN`.
3. **Desplegar:** cada push a `main` ejecuta `deploy.yml` (también se puede lanzar a mano en Actions).
   El pipeline valida Terraform, crea el ECR, construye y publica la imagen, aplica la infraestructura, espera a que ECS
   esté estable, crea las tablas y prueba `/health`. Al final imprime la URL pública.
4. **Eliminar:** Actions → **Destroy V3 from AWS** → Run workflow → escribir `DESTROY`.

> Nota: la organización de AWS usada bloquea el proveedor OIDC de GitHub, por eso el pipeline se autentica con
> credenciales guardadas como secrets. Donde OIDC esté permitido es la alternativa más segura (sin claves almacenadas).

## Costos

Mientras la infraestructura está activa se cobra principalmente NAT Gateway, ALB, RDS y Fargate (del orden de décimas
de dólar por hora). Se recomienda ejecutar el destroy al terminar cada sesión de trabajo o demostración.

## Convención de commits

Los commits usan [GitMoji](https://gitmoji.dev): `:sparkles:` nueva funcionalidad, `:bug:` corrección,
`:zap:` mejora, `:memo:` documentación, `:art:` formato, `:rocket:` despliegue.

## Historial de versiones

| Versión | Descripción |
|---|---|
| `v1.0.0` | Versión inicial de la API |
| `v2.0.0` | Arquitectura multicloud: Kubernetes (EKS), SQS, APIs externas en GCP/Azure y observabilidad con Grafana Cloud |
| `v3.0.0` | Infraestructura como código con Terraform en AWS (ECS Fargate, RDS, ALB, ECR, Secrets Manager) y pipelines de despliegue/destrucción |
