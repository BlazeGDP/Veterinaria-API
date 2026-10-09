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
# init-database.js busca el schema en <cwd>/src/database/schema.sql
COPY --from=builder /app/src/database/schema.sql ./src/database/schema.sql
COPY --from=builder /app/scripts/init-database.js ./scripts/init-database.js

EXPOSE 3000

CMD ["node", "dist/main.js"]
