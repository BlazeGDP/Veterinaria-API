# API RESTful Veterinaria

API RESTful para la gestión de una veterinaria, desarrollada con NestJS,
Fastify, TypeORM y PostgreSQL. Incluye CRUD para propietarios, mascotas
y citas; consultas requeridas; método HTTP QUERY; pruebas unitarias con
Jest; Quality Gates de coverage; GitHub Actions y ejecución mediante
Docker.

## 1. Requisitos

Para ejecutar el proyecto en otro computador se recomienda Docker:

-   Git
-   Docker Desktop

Comprobar instalación:

``` powershell
git --version
docker --version
docker compose version
```

Para ejecución sin Docker también se requiere Node.js 24.

## 2. Clonar el proyecto

``` powershell
git clone https://github.com/BlazeGDP/Veterinaria-API.git
cd Veterinaria-API
```

## 3. Variables de entorno

Los archivos `.env` reales no se encuentran en GitHub.

Crear el archivo local a partir de la plantilla:

``` powershell
Copy-Item .env.example .env
```

Editar:

``` powershell
notepad .env
```

Ejemplo:

``` env
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=veterinaria_user
DATABASE_PASSWORD=veterinaria_password
DATABASE_NAME=veterinaria
DATABASE_SCHEMA=schema_testing
```

Para Production se utiliza `schema_production`.

En Render se utiliza `DATABASE_URL`, que Render genera automáticamente al
conectar los servicios con la base PostgreSQL del archivo `render.yaml`.

**No subir nunca los archivos `.env` reales al repositorio.**

## 4. Ejecutar con Docker

Construir e iniciar la API y PostgreSQL:

``` powershell
docker compose up -d --build
```

Comprobar:

``` powershell
docker compose ps
```

Ver logs:

``` powershell
docker compose logs -f api
```

La API queda disponible en:

``` text
http://localhost:3000
```

Ejemplo:

``` text
GET http://localhost:3000/owners
```

Detener:

``` powershell
docker compose down
```

Para eliminar también los datos persistidos:

``` powershell
docker compose down -v
```

## 5. Base de datos

Se utiliza PostgreSQL 16.

Configuración:

``` text
Base de datos: veterinaria
Usuario: veterinaria_user
Puerto: 5432
```

La misma base de datos contiene dos esquemas:

``` text
veterinaria
├── schema_testing
└── schema_production
```

Testing utiliza `schema_testing` y Production utiliza
`schema_production`.

La aplicación tiene `synchronize: false`, por lo que TypeORM no crea
automáticamente las tablas. En una instalación completamente nueva se
debe ejecutar el script SQL/schema del proyecto que crea los esquemas y
tablas.

Ejemplo, si el proyecto contiene `schema.sql`:

``` powershell
docker exec -i veterinaria-postgres psql -U veterinaria_user -d veterinaria < schema.sql
```

## 6. Deploy en Render

El archivo `render.yaml` define una base PostgreSQL y dos servicios web:

``` text
veterinaria-api-testing     -> schema_testing
veterinaria-api-production  -> schema_production
```

Configuración inicial:

1. Subir estos cambios a GitHub.
2. En Render seleccionar **New > Blueprint** y conectar el repositorio.
3. Seleccionar el archivo `render.yaml` y aplicar el Blueprint.
4. Esperar a que la base y ambos servicios terminen de desplegarse.
5. Copiar la URL pública de cada Web Service desde Render.

Al iniciar, cada servicio ejecuta `src/database/schema.sql` de forma
idempotente y crea los dos esquemas y sus tablas. El servicio testing usa
`schema_testing`; el servicio production usa `schema_production`.

Las URLs tendrán este formato:

``` text
https://veterinaria-api-testing.onrender.com
https://veterinaria-api-production.onrender.com
```

Las peticiones se hacen agregando el endpoint, por ejemplo:

``` text
GET https://veterinaria-api-testing.onrender.com/owners
GET https://veterinaria-api-production.onrender.com/owners
```

Render asigna el puerto mediante `PORT`; la aplicación ya escucha en
`0.0.0.0`, por lo que no se debe fijar otro puerto en el Blueprint.

### Deploy desde GitHub Actions

Render puede desplegar automáticamente con `autoDeploy: true`. Si se desea
que el pipeline sea quien dispare el deploy después de pasar las pruebas:

1. En cada Web Service abrir **Settings > Deploy Hook** y crear un hook.
2. En GitHub abrir **Settings > Secrets and variables > Actions**.
3. Crear `RENDER_TESTING_DEPLOY_HOOK` con el hook de testing.
4. Crear `RENDER_PRODUCTION_DEPLOY_HOOK` con el hook de production.

Los workflows solo llaman al hook en un push a `main` y después de build,
coverage y Docker build exitosos.

## 7. Entidades y endpoints

### Owners

``` text
POST   /owners
GET    /owners
GET    /owners/:id
PATCH  /owners/:id
DELETE /owners/:id
```

### Pets

``` text
POST   /pets
GET    /pets
GET    /pets/:id
PATCH  /pets/:id
DELETE /pets/:id
```

### Appointments

``` text
POST   /appointments
GET    /appointments
GET    /appointments/:id
PATCH  /appointments/:id
DELETE /appointments/:id
```

## 8. Consultas requeridas

El proyecto implementa:

-   Buscar mascotas por especie.
-   Buscar citas por fecha.
-   Buscar mascotas de un dueño.

Consultar los controladores/servicios del proyecto para los parámetros
exactos de cada consulta.

## 9. Método QUERY

El proyecto registra el método HTTP `QUERY` mediante Fastify:

``` typescript
fastify.addHttpMethod('QUERY', {
  hasBody: true,
});
```

Esto permite cumplir el requisito académico de utilizar el verbo HTTP
QUERY.

## 10. Validación

La API utiliza `ValidationPipe` global con:

``` typescript
whitelist: true
forbidNonWhitelisted: true
transform: true
```

Los DTO validan los datos recibidos y rechazan propiedades no
permitidas.

## 11. Testing

Ejecutar todas las pruebas:

``` powershell
npm test
```

Coverage:

``` powershell
npm run test:cov
```

Testing:

``` powershell
npm run test:testing
```

Production:

``` powershell
npm run test:production
```

Las pruebas unitarias aíslan la lógica mediante mocks y no dependen de
una conexión real a PostgreSQL.

El proyecto cuenta con 67 pruebas unitarias que fueron ejecutadas
exitosamente durante el desarrollo.

## 12. Coverage y Quality Gates

Production utiliza un Quality Gate global del 85% para:

-   Branches
-   Functions
-   Lines
-   Statements

Si Jest no alcanza el umbral configurado, el comando termina con error y
GitHub Actions detiene el pipeline.

Durante la validación se comprobó el comportamiento aumentando
temporalmente el requisito a 99%: el coverage real no alcanzó ese valor
y el pipeline falló antes de construir la imagen Docker.

## 13. GitHub Actions

Workflows:

``` text
.github/workflows/testing.yml
.github/workflows/production.yml
```

Flujo:

``` text
Checkout
  ↓
Setup Node.js
  ↓
npm ci
  ↓
Build
  ↓
Tests + Coverage
  ↓
Docker Build
```

El Docker Build solamente se ejecuta si las etapas anteriores terminan
correctamente.

## 14. Docker

Construir manualmente la imagen:

``` powershell
docker build -t veterinaria-api .
```

El Dockerfile utiliza una construcción multi-stage: una etapa compila la
aplicación y otra contiene la aplicación preparada para producción.

Docker Compose ejecuta PostgreSQL y la API.

## 15. Instalación completa desde cero

``` powershell
git clone https://github.com/BlazeGDP/Veterinaria-API.git
cd Veterinaria-API

Copy-Item .env.example .env
notepad .env

docker compose up -d --build
docker compose ps
docker compose logs -f api
```

Después probar en Postman:

``` text
GET http://localhost:3000/owners
```

**Importante:** en una base de datos completamente nueva hay que
ejecutar primero el script SQL/schema del proyecto para crear esquemas y
tablas, porque `synchronize` está desactivado.

## 16. Ejecución sin Docker

Instalar Node.js 24 y luego:

``` powershell
npm ci
npm run build
npm run start:dev
```

La aplicación requiere PostgreSQL disponible y correctamente configurado
en `.env`.

## 17. Solución de problemas

Puerto 3000 ocupado:

``` powershell
netstat -ano | findstr :3000
```

Estado de Docker:

``` powershell
docker compose ps
```

Logs de API:

``` powershell
docker compose logs api
```

Logs de PostgreSQL:

``` powershell
docker compose logs postgres
```

Recrear contenedores:

``` powershell
docker compose down
docker compose up -d --build
```

Cuando la API está dentro de Docker, el host de PostgreSQL es
`postgres`, porque corresponde al nombre del servicio de Docker Compose.
Cuando la API se ejecuta directamente en Windows, normalmente se utiliza
`localhost`.

## 18. Comandos principales

``` powershell
npm ci
npm run start
npm run start:dev
npm run build
npm test
npm run test:cov
npm run test:testing
npm run test:production

docker compose up -d --build
docker compose ps
docker compose logs -f api
docker compose down
```

## 19. Repositorio

https://github.com/BlazeGDP/Veterinaria-API

## 20. Estado

La implementación técnica, testing, Quality Gates, Docker y CI mediante
GitHub Actions se encuentran completados. La etapa restante corresponde
a documentación y presentación académica.
