# Multi-stage production Dockerfile para Barcode Deal Hunter Backend
FROM node:20-alpine AS builder

WORKDIR /app

# Instalar dependencias
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

# Copiar código fuente y compilar TypeScript
COPY tsconfig.json ./
COPY src ./src/

RUN npx prisma generate
RUN npm run build

# Imagen de producción ligera
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

COPY package*.json ./
COPY prisma ./prisma/

# Instalar sólo dependencias de producción
RUN npm ci --omit=dev && npx prisma generate

# Copiar el código compilado desde la etapa builder
COPY --from=builder /app/dist ./dist

EXPOSE 4000

# Ejecutar migraciones automáticas al iniciar y levantar el servidor
CMD ["sh", "-c", "npx prisma db push && node dist/index.js"]
