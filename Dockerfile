# Etapa 1: construcción de la aplicación
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar todas las dependencias necesarias para compilar
RUN npm ci

# Copiar el código del proyecto
COPY . .

# Compilar NestJS
RUN npm run build


# Etapa 2: imagen final de producción
FROM node:20-alpine AS production

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar únicamente dependencias de producción
RUN npm ci --omit=dev

# Copiar la aplicación compilada
COPY --from=builder /app/dist ./dist

# Copiar certificado CA de Amazon RDS
COPY global-bundle.pem ./global-bundle.pem

# Puerto utilizado por NestJS
EXPOSE 3000

# Iniciar la API
CMD ["node", "dist/main.js"]