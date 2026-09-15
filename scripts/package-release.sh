#!/usr/bin/env bash
#
# AXIOM — Empaquetado para distribución
# Este script copia a un directorio limpio SÓLO lo que debe distribuirse,
# verifica el resultado y luego comprime.
#
# Uso:
#   bash scripts/package-release.sh          → .zip  (por defecto)
#   bash scripts/package-release.sh --tar    → .tar.gz
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

STAMP="$(date +%Y%m%d)"
NAME="axiom-${STAMP}"
OUT_DIR="${ROOT}/dist-release"
STAGE="${OUT_DIR}/${NAME}"
FORMAT="zip"
[ "${1:-}" = "--tar" ] && FORMAT="tar"

# Se trabaja por LISTA BLANCA, no por exclusiones.
INCLUDE_DIRS=(
  "src"
  "prisma"
  "scripts"
  "tests"
  "public"
  "docs"
  "mini-services"
  ".github"
  "db"
)

INCLUDE_FILES=(
  ".env.example"
  ".gitignore"
  "package.json"
  "bun.lock"
  "tsconfig.json"
  "next.config.ts"
  "next-env.d.ts"
  "tailwind.config.ts"
  "postcss.config.mjs"
  "eslint.config.mjs"
  "vitest.config.ts"
  "playwright.config.ts"
  "components.json"
  "Caddyfile"
  "README.md"
)

echo "▸ Preparando copia limpia…"
rm -rf "$STAGE"
mkdir -p "$STAGE"

for d in "${INCLUDE_DIRS[@]}"; do
  [ -d "$ROOT/$d" ] || continue
  mkdir -p "$STAGE/$d"
  # --exclude protege de residuos dentro de los directorios permitidos:
  # bases de datos de prueba, node_modules de los mini-servicios, logs.
  tar -c \
    --exclude='node_modules' \
    --exclude='*.db' --exclude='*.db-journal' \
    --exclude='*.sqlite' --exclude='*.sqlite3' \
    --exclude='*.log' --exclude='__pycache__' \
    --exclude='.z-ai-config' \
    --exclude='*.pem' --exclude='*.key' \
    -C "$ROOT" "$d" | tar -x -C "$STAGE" --strip-components=0
  rm -rf "$STAGE/$d.tmp" 2>/dev/null || true
done

for f in "${INCLUDE_FILES[@]}"; do
  [ -f "$ROOT/$f" ] && cp "$ROOT/$f" "$STAGE/$f"
done

# Instrucciones de puesta en marcha para la máquina destino.

echo "▸ Verificando…"
LEAKED="$(find "$STAGE" \( \
    -name '.env' -o -name '.env.local' -o -name '.env.production' \
    -o -name '*.db' -o -name '*.sqlite' -o -name '*.sqlite3' \
    -o -name '*.pem' -o -name '*.key' -o -name '.z-ai-config' \
    -o -name 'node_modules' -o -path '*/db/*' -o -path '*/storage/*' \
  \) 2>/dev/null || true)"

if [ -n "$LEAKED" ]; then
  echo ""
  echo "✗ ABORTADO: la copia contiene archivos que no deben distribuirse:"
  echo "$LEAKED" | head -20
  rm -rf "$STAGE"
  exit 1
fi

if [ ! -f "$STAGE/.env.example" ]; then
  echo "✗ ABORTADO: falta .env.example; quien lo reciba no sabría qué configurar."
  rm -rf "$STAGE"
  exit 1
fi

# Compresión
if [ "$FORMAT" = "tar" ]; then
  ARCHIVE="${OUT_DIR}/${NAME}.tar.gz"
  rm -f "$ARCHIVE"
  tar -czf "$ARCHIVE" -C "$OUT_DIR" "$NAME"
else
  ARCHIVE="${OUT_DIR}/${NAME}.zip"
  rm -f "$ARCHIVE"
  #   · `Compress-Archive` (PowerShell 5.1) escribe barras INVERTIDAS.
  #   · `ZipFile::CreateFromDirectory` de .NET Framework 4.x, también.
  # `zip` y el módulo `zipfile` de Python sí escriben rutas POSIX.
  if command -v zip >/dev/null 2>&1; then
    (cd "$OUT_DIR" && zip -r -q "${NAME}.zip" "$NAME")
  elif command -v python >/dev/null 2>&1 || command -v python3 >/dev/null 2>&1; then
    PY="$(command -v python3 || command -v python)"
    "$PY" - "$OUT_DIR" "$NAME" <<'PYZIP'
import os, sys, zipfile
out_dir, name = sys.argv[1], sys.argv[2]
stage = os.path.join(out_dir, name)
archive = os.path.join(out_dir, name + '.zip')

with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for root, dirs, files in os.walk(stage):
        dirs.sort(); files.sort()
        for f in files:
            full = os.path.join(root, f)
            # arcname relativo al padre del stage, con separador POSIX.
            rel = os.path.relpath(full, out_dir).replace(os.sep, '/')
            z.write(full, rel)
PYZIP
  else
    echo "✗ No hay forma de crear un ZIP: instala 'zip' o Python." >&2
    exit 1
  fi
fi

COUNT="$(find "$STAGE" -type f | wc -l | tr -d ' ')"
SIZE="$(du -h "$ARCHIVE" | cut -f1)"
rm -rf "$STAGE"

echo ""
echo "✓ Paquete listo"
echo "   Archivo:  $ARCHIVE"
echo "   Tamaño:   $SIZE"
echo "   Archivos: $COUNT"
echo ""
echo "   En la máquina destino, tras descomprimir:"
echo "     1. bun install"
echo "     2. cp .env.example .env   (completar JWT_SECRET y OPENROUTER_API_KEY)"
echo "     3. bunx prisma db push"
echo "     4. bun run scripts/seed.ts"
echo "     5. bun run dev            → http://localhost:3000"
echo ""
echo "   Instrucciones completas: README.md dentro del paquete."
