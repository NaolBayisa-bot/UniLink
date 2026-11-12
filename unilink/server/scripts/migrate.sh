#!/usr/bin/env bash
#
# migrate.sh - apply, roll back, or list yoyo-migrations for the Unilink API.
#
# Reads DATABASE_URL from .env and rewrites the scheme to postgresql+psycopg://
# (the form psycopg 3 / yoyo-migrations needs).
#
# Usage: ./scripts/migrate.sh {up|down|list}
#
set -euo pipefail

SERVER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$SERVER_DIR/.env"

if [[ ! -f "$ENV_FILE" ]]; then
    echo "Error: .env not found at $ENV_FILE" >&2
    exit 1
fi

# Load .env into the environment (overrides nothing already exported).
set -a
. "$ENV_FILE"
set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "Error: DATABASE_URL is not set in .env" >&2
    exit 1
fi

# Convert the scheme to postgresql+psycopg:// for psycopg 3 / yoyo.
DB="$DATABASE_URL"
case "$DB" in
    postgres://*)
        DB="postgresql+psycopg://${DB#postgres://}"
        ;;
    postgresql+psycopg://*)
        : # already in the form yoyo needs
        ;;
    postgresql://*)
        DB="postgresql+psycopg://${DB#postgresql://}"
        ;;
    *)
        echo "Error: unsupported DATABASE_URL scheme: $DB" >&2
        exit 1
        ;;
esac

MIGRATIONS_DIR="$SERVER_DIR/migrations"

usage() {
    cat <<EOF
Usage: $0 {up|down|list}

  up     Apply all pending migrations   (yoyo apply --batch)
  down   Roll back all migrations       (yoyo rollback --batch)
  list   List migrations and status     (yoyo list)

Reads DATABASE_URL from .env. Migrations are read from migrations/.
EOF
}

cmd="${1:-}"
case "$cmd" in
    up)
        yoyo apply --batch -d "$DB" "$MIGRATIONS_DIR"
        ;;
    down)
        yoyo rollback --batch -d "$DB" "$MIGRATIONS_DIR"
        ;;
    list)
        yoyo list -d "$DB" "$MIGRATIONS_DIR"
        ;;
    *)
        usage
        exit 1
        ;;
esac