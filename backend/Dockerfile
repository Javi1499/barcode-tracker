# Multi-stage production Dockerfile para Barcode Tracker Backend
FROM node:20-slim AS builder

WORKDIR /app

# Instalar OpenSSL requerido por el motor de Prisma
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Instalar dependencias
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

# Copiar código fuente y compilar TypeScript
COPY tsconfig.json ./
COPY src ./src/

RUN npx prisma generate
RUN npm run build

# Imagen de producción ligera basada en Debian Slim
FROM node:20-slim AS runner

WORKDIR /app

# Instalar OpenSSL en el contenedor de ejecución
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=4000

COPY package*.json ./
COPY prisma ./prisma/

# Instalar sólo dependencias de producción y generar cliente Prisma
RUN npm ci --omit=dev && npx prisma generate

# Copiar el código compilado desde la etapa builder
COPY --from=builder /app/dist ./dist

EXPOSE 4000

# Ejecutar sincronización de tablas en PostgreSQL y levantar servidor Express
CMD ["sh", "-c", "npx prisma db push && node dist/index.js"]

