FROM node:lts-alpine AS base
WORKDIR /app

# ── Build emdash from GitHub ──────────────────────────────────────────────────
# The emdash packages are referenced via file: paths in package.json and must
# be built from source before npm ci can run. This stage clones main, builds
# the required packages, and packs them as tarballs.

FROM node:lts-alpine AS emdash-builder
WORKDIR /emdash-build

RUN apk add --no-cache git python3 make g++ && \
    npm install -g pnpm

# Clone emdash at latest main
RUN git clone --depth=1 https://github.com/emdash-cms/emdash.git .

# Apply local patches from the project (if any exist)
COPY patches/ /patches/
RUN if ls /patches/*.patch 1>/dev/null 2>&1; then \
      for p in /patches/*.patch; do \
        git apply --check "$p" 2>/dev/null && git apply "$p" && echo "Applied $(basename $p)" || echo "Skipped $(basename $p) (already applied or conflict)"; \
      done; \
    fi

RUN pnpm install --ignore-scripts && \
    pnpm --filter @emdash-cms/auth build && \
    pnpm --filter @emdash-cms/gutenberg-to-portable-text build && \
    pnpm --filter @emdash-cms/admin build && \
    pnpm --filter emdash build

RUN mkdir -p /emdash-packs && \
    pnpm --filter emdash pack --pack-destination /emdash-packs && \
    pnpm --filter @emdash-cms/admin pack --pack-destination /emdash-packs && \
    find /emdash-packs -name 'emdash-[0-9]*.tgz' -exec mv {} /emdash-packs/emdash.tgz \; && \
    find /emdash-packs -name 'emdash-cms-admin-[0-9]*.tgz' -exec mv {} /emdash-packs/emdash-cms-admin.tgz \;

# ── Install dependencies ───────────────────────────────────────────────────────

FROM base AS prod-deps
RUN apk add --no-cache python3 make g++
COPY package.json ./
# Copy tarballs to match the file: paths in package.json
COPY --from=emdash-builder /emdash-packs/emdash.tgz ./tmp/emdash-packs/emdash.tgz
COPY --from=emdash-builder /emdash-packs/emdash-cms-admin.tgz ./tmp/emdash-packs/emdash-cms-admin.tgz
RUN npm install --omit=dev

FROM base AS build-deps
RUN apk add --no-cache python3 make g++
COPY package.json ./
COPY --from=emdash-builder /emdash-packs/emdash.tgz ./tmp/emdash-packs/emdash.tgz
COPY --from=emdash-builder /emdash-packs/emdash-cms-admin.tgz ./tmp/emdash-packs/emdash-cms-admin.tgz
RUN npm install

# ── Build the Astro site ───────────────────────────────────────────────────────

FROM build-deps AS build
COPY . .
RUN npm run build

# ── Runtime image ─────────────────────────────────────────────────────────────

FROM node:lts-alpine AS runtime
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

ENV HOST=0.0.0.0
ENV PORT=4321
EXPOSE 4321
CMD ["node", "./dist/server/entry.mjs"]
