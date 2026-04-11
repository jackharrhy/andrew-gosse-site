#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EMDASH_DIR="$ROOT/tmp/emdash"
PACKS_DIR="$ROOT/tmp/emdash-packs"

# ── Clone or pull ─────────────────────────────────────────────────────────────
# Pass --no-pull to skip the git step (e.g. when CI has already cloned)

if [[ "${1:-}" != "--no-pull" ]]; then
  if [ -d "$EMDASH_DIR/.git" ]; then
    echo "→ Pulling latest emdash main..."
    git -C "$EMDASH_DIR" pull
  else
    echo "→ Cloning emdash..."
    git clone --depth=1 https://github.com/emdash-cms/emdash.git "$EMDASH_DIR"
  fi
else
  echo "→ Skipping clone/pull (--no-pull)"
fi

cd "$EMDASH_DIR"

# ── Install deps ──────────────────────────────────────────────────────────────

echo "→ Installing emdash monorepo deps..."
pnpm install --ignore-scripts

# ── Build all required packages ───────────────────────────────────────────────

echo "→ Building @emdash-cms/auth..."
pnpm --filter @emdash-cms/auth build

echo "→ Building @emdash-cms/gutenberg-to-portable-text..."
pnpm --filter @emdash-cms/gutenberg-to-portable-text build

echo "→ Building @emdash-cms/admin..."
pnpm --filter @emdash-cms/admin build

echo "→ Building emdash (core)..."
pnpm --filter emdash build

# ── Pack and rename to fixed filenames ────────────────────────────────────────

mkdir -p "$PACKS_DIR"

# Remove any previous tarballs so the glob mv below matches exactly one file
rm -f "$PACKS_DIR"/emdash-*.tgz "$PACKS_DIR"/emdash.tgz "$PACKS_DIR"/emdash-cms-admin.tgz

echo "→ Packing emdash..."
pnpm --filter emdash pack --pack-destination "$PACKS_DIR"
mv "$PACKS_DIR"/emdash-*.tgz "$PACKS_DIR/emdash.tgz"

echo "→ Packing @emdash-cms/admin..."
pnpm --filter @emdash-cms/admin pack --pack-destination "$PACKS_DIR"
mv "$PACKS_DIR"/emdash-cms-admin-*.tgz "$PACKS_DIR/emdash-cms-admin.tgz"

# ── Install into the site ─────────────────────────────────────────────────────

echo "→ Installing into site..."
cd "$ROOT"
npm install

echo "✓ emdash updated and installed"
