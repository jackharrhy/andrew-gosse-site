FROM node:24.22.1-bookworm-slim AS deps
RUN apt-get update && apt-get upgrade -y \
    && apt-get install -y --no-install-recommends ca-certificates \
    && update-ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24.22.1-bookworm-slim AS builder
RUN apt-get update && apt-get upgrade -y \
    && apt-get install -y --no-install-recommends ca-certificates \
    && update-ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24.22.1-bookworm-slim AS runner
RUN apt-get update && apt-get upgrade -y \
    && apt-get install -y --no-install-recommends ca-certificates \
    && update-ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/app ./app
COPY --from=builder /app/db ./db
COPY --from=builder /app/public ./public
COPY --from=builder /app/server.ts /app/package.json /app/tsconfig.json ./
RUN mkdir /app/data && chown node:node /app/data
USER node
EXPOSE 4331
ENV HOST=0.0.0.0 PORT=4331 TEA_DATA_DIR=/app/data
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s CMD node -e "fetch('http://127.0.0.1:4331/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "--import", "remix/node-tsx", "server.ts"]
