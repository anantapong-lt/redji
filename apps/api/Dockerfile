FROM oven/bun:1-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json ./
RUN bun install --production

FROM base AS builder
COPY package.json ./
RUN bun install
COPY . .

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=4000

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app .

EXPOSE 4000

CMD ["bun", "run", "src/index.ts"]
