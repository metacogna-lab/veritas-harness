FROM oven/bun:latest AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:latest
RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
HEALTHCHECK --interval=30s --timeout=10s CMD bun run doctor || exit 1
VOLUME ["/app/.veritas"]
ENTRYPOINT ["bun", "run", "dev"]
CMD ["loadouts"]
