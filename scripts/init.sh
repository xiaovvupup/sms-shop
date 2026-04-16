#!/usr/bin/env bash
set -euo pipefail

echo "[1/4] Installing dependencies..."
npm install

echo "[2/4] Generating Prisma client..."
npx prisma generate

echo "[3/4] Running database migrations..."
npx prisma migrate dev --name init

echo "[4/4] Seeding admin user and sample activation codes..."
npm run prisma:seed

echo "[5/5] Syncing activation code txt snapshot..."
npm run codes:sync

echo "Initialization complete."
