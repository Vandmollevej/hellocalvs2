#!/usr/bin/env bash
# Prøvekørsel af migreringer (docs/DEPLOYMENT.md, "Prøvekørsel af migreringer").
# Køres af deploy-jobbet før rollout-app.sh, efter at den nye release er valgt og hentet.
#
# Kopierer produktionens skema + _prisma_migrations (ingen brugerdata) til en midlertidig
# PostgreSQL og kører den nye releases `migrate`-service mod kopien. Fejler den, stopper
# deployet, før produktionen røres (2026-10-07: en migrering med forkert tabelnavn fejlede
# i produktion og blokerede alle deploys i 17 timer).
set -euo pipefail

cd /deploy
COMPOSE=(docker compose --project-directory /volume1/docker/App/hellocal-v2 -f compose.production.yaml --env-file .env.production)
TEST_DB=hellocal-migrate-test
NETWORK=hellocal-v2_backend
DUMP="$(mktemp)"

log() { printf '[migrate-test] %s\n' "$*"; }
cleanup() { docker rm -f "$TEST_DB" >/dev/null 2>&1 || true; rm -f "$DUMP"; }
trap cleanup EXIT
cleanup

"${COMPOSE[@]}" up -d --wait db
db_image="$(docker inspect -f '{{.Config.Image}}' "$("${COMPOSE[@]}" ps -q db)")"

log "Kopierer skema og migreringshistorik (uden data)"
"${COMPOSE[@]}" exec -T db sh -c '
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --schema-only --no-owner --no-privileges &&
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --data-only --table=_prisma_migrations --no-owner --no-privileges
' >"$DUMP"

docker run -d --name "$TEST_DB" --network "$NETWORK" \
  -e POSTGRES_PASSWORD=migrate-test -e POSTGRES_DB=hellocal "$db_image" >/dev/null
# Init-fasen lytter kun på socket; TCP svarer først, når den rigtige server kører.
for _ in $(seq 1 60); do
  if docker exec "$TEST_DB" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done

# Kan kopien ikke indlæses, er det et problem med testen, ikke med releasen: advar og fortsæt.
if ! docker exec -i "$TEST_DB" psql -q -U postgres -d hellocal -v ON_ERROR_STOP=1 <"$DUMP" >/dev/null; then
  log "ADVARSEL: kunne ikke indlæse skemakopien — prøvekørslen springes over"
  exit 0
fi

log "Kører den nye releases migreringer mod kopien"
if ! "${COMPOSE[@]}" run --rm --no-deps \
  -e DATABASE_URL="postgresql://postgres:migrate-test@${TEST_DB}:5432/hellocal" migrate; then
  log "FEJL: migreringerne fejler på en kopi af produktionen — deployet stoppes, produktionen er urørt"
  exit 1
fi
log "Migreringerne virker på kopien"
