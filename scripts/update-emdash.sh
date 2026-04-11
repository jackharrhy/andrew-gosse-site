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

# ── Apply local patches ───────────────────────────────────────────────────────
# Patches live in $ROOT/patches/ and are applied after every pull.
# If a patch is already applied (git apply --check fails), skip silently.

PATCHES_DIR="$ROOT/patches"
if [ -d "$PATCHES_DIR" ] && ls "$PATCHES_DIR"/*.patch 1>/dev/null 2>&1; then
  echo "→ Applying local patches..."
  for patch in "$PATCHES_DIR"/*.patch; do
    if git apply --check "$patch" 2>/dev/null; then
      git apply "$patch"
      echo "  ✓ $(basename "$patch")"
    else
      echo "  ⚠ $(basename "$patch") already applied or conflicts — skipping"
    fi
  done
fi

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

echo "→ Clearing stale integrity hashes in lockfile..."
cd "$ROOT"
# npm caches integrity hashes for file: dependencies — after repacking the
# tarballs change and the old hashes fail. Clear them so npm recomputes.
python3 -c "
import json, sys
try:
    with open('package-lock.json') as f:
        lock = json.load(f)
    for key, pkg in lock.get('packages', {}).items():
        if 'emdash-packs' in pkg.get('resolved', '') and 'integrity' in pkg:
            del pkg['integrity']
    with open('package-lock.json', 'w') as f:
        json.dump(lock, f, indent=2)
        f.write('\n')
except Exception as e:
    print(f'Warning: could not clear integrity hashes: {e}', file=sys.stderr)
"

echo "→ Installing into site..."
npm install

echo "✓ emdash updated and installed"
