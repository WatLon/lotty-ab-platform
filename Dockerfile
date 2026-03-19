# syntax=docker/dockerfile:1

# ============ deps ============
FROM oven/bun:1.3.9-alpine AS deps
WORKDIR /app
ENV CI=true
ENV DISABLE_OPENCOLLECTIVE=true

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production

# ============ build ============
FROM deps AS build
WORKDIR /app

# Install only missing dev dependencies on top of already installed production deps.
RUN bun install --frozen-lockfile

COPY . .

RUN bun run typecheck:all

# ============ production ============
FROM oven/bun:1.3.9-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

# Создать непривилегированного пользователя (alpine синтаксис)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Копируем только production deps из deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/src ./src
COPY --from=build /app/generated ./generated
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/package.json ./
COPY --from=build /app/tsconfig.json ./tsconfig.json

# Права пользователя
RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["bun", "src/apps/control-api/main.ts"]
