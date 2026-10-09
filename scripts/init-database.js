const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const schemaPath = [
  path.join(process.cwd(), 'src', 'database', 'schema.sql'),
  path.join(process.cwd(), 'dist', 'database', 'schema.sql'),
].find((candidate) => fs.existsSync(candidate));

if (!schemaPath) {
  throw new Error('No se encontró src/database/schema.sql ni dist/database/schema.sql');
}

// RDS PostgreSQL 16 fuerza SSL por defecto: usamos la misma variable que la API.
const sslEnabled = process.env.DATABASE_SSL === 'true';

const connectionConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: sslEnabled || process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : undefined,
    }
  : {
      host: process.env.DATABASE_HOST || 'localhost',
      port: Number(process.env.DATABASE_PORT || 5432),
      user: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
      ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
    };

async function initializeDatabase() {
  const client = new Client(connectionConfig);

  await client.connect();
  await client.query(fs.readFileSync(schemaPath, 'utf8'));
  await client.end();
  console.log('Esquema de base de datos inicializado correctamente.');
}

initializeDatabase().catch((error) => {
  console.error('No se pudo inicializar la base de datos:', error);
  process.exit(1);
});
