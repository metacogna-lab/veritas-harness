FROM oven/bun:latest AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:latest
RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# The API layer (and, unless RUN_WORKER=false, the autonomous job runner) launches
# with the container. Health is the HTTP /health endpoint.
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s \
  CMD bun -e "fetch('http://localhost:8080/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
VOLUME ["/app/.veritas", "/app/missions", "/app/resources/experience"]
ENTRYPOINT ["bun", "run", "serve"]
