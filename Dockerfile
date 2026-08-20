FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

FROM node:24-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./

RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

COPY scripts ./scripts
COPY src/database/schema.sql ./dist/database/schema.sql

EXPOSE 3000

CMD ["sh", "-c", "node scripts/init-database.js && node dist/main.js"]