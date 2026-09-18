# --- Stage 1: build ---
# Node 22 wajib — better-sqlite3 terbaru butuh >=22 untuk dapat
# prebuilt binary yang cocok (lihat catatan di package.json "engines").
# Build tools (python3, build-essential) disiapkan sebagai fallback
# KALAU prebuilt binary untuk platform ini tidak tersedia — tidak
# dipakai kalau prebuilt ketemu, tapi aman ada di tahap build ini.
FROM node:22-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
# Pakai npm install (bukan npm ci) — project ini masih aktif berubah
# lewat coding agent, package-lock.json kadang belum sinkron kalau
# ada dependency baru ditambahkan manual ke package.json. npm install
# akan re-resolve dan regenerate lock file otomatis kalau perlu.
RUN npm install --omit=dev

# --- Stage 2: runtime ---
# Image akhir bersih — TIDAK ikut bawa Python/compiler dari stage
# builder, cuma node_modules hasil install-nya saja.
FROM node:22-bookworm-slim

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
COPY . .

VOLUME ["/app/data"]

EXPOSE 3000

CMD ["node", "src/server.js"]
