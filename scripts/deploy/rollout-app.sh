#!/usr/bin/env bash
# Udrulning uden nedetid (docs/DEPLOYMENT.md, "Udrulning uden nedetid").
# Køres af deploy-jobbet i /deploy, efter at den nye release er valgt (HELLOCAL_TAG) og images er hentet.
#
# Princip: den nye app-container startes ved siden af den gamle; først når den er sund, stoppes den gamle.
# edge-proxy (nginx) ejer port 3100 og sender til alle app-containere. Fejler noget, før den nye er sund,
# fjernes den nye, og den gamle bliver ved med at tjene — udrulningen fejler, men sitet er uberørt.
set -euo pipefail

cd /deploy
COMPOSE=(docker compose --project-directory /volume1/docker/App/hellocal-v2 -f compose.production.yaml --env-file .env.production)
HOST_DIR=/volume1/docker/App/hellocal-v2
NGINX_IMAGE=nginx:1.27-alpine

log() { printf '[rollout] %s\n' "$*"; }

# 1) Kontrollér proxy-konfigurationen, før noget ændres (en fejl her må ikke tage sitet ned).
log "Tester nginx-konfigurationen"
docker run --rm --entrypoint nginx \
  -v "$HOST_DIR/scripts/edge-proxy/nginx.conf:/etc/nginx/conf.d/default.conf:ro" \
  "$NGINX_IMAGE" -t

# Migreringerne køres eksplicit, før nogen ny app-container startes. `up --no-recreate` nedenfor
# genbruger ellers den gamle, afsluttede migrate-container som "gennemført", så ny kode gik i drift
# før (og uden) sine migreringer (2026-10-06). Fejler de, stopper udrulningen her; den gamle app kører videre.
log "Kører database-migreringer"
"${COMPOSE[@]}" up -d --wait db
"${COMPOSE[@]}" run --rm --no-deps migrate

old_ids="$("${COMPOSE[@]}" ps -q app || true)"

# 2) Første gang (eller hvis app ikke kører): almindelig opstart. I den allerførste udrulning med proxy
#    ejer den gamle app-container stadig port 3100 — så genskabes app uden port, og proxyen overtager den.
publishes_port=false
if [ -n "$old_ids" ]; then
  for id in $old_ids; do
    if [ -n "$(docker inspect -f '{{range $p, $b := .NetworkSettings.Ports}}{{if $b}}{{$p}}{{end}}{{end}}' "$id")" ]; then
      publishes_port=true
    fi
  done
fi
if [ -z "$old_ids" ] || [ "$publishes_port" = true ]; then
  log "Almindelig opstart (første gang eller gammel app med udgivet port) — kort afbrydelse kan forekomme"
  "${COMPOSE[@]}" up -d db migrate app scan-app edge-proxy
  exit 0
fi

# 3) Start en ekstra app-container med den nye release (migrationer køres først via depends_on).
log "Starter ny app-container ved siden af den gamle"
"${COMPOSE[@]}" up -d --scale app=2 --no-recreate app

new_ids=""
for id in $("${COMPOSE[@]}" ps -q app); do
  if ! grep -qx "$id" <<<"$old_ids"; then new_ids="$new_ids $id"; fi
done
new_ids="$(echo "$new_ids" | xargs || true)"
if [ -z "$new_ids" ]; then
  log "Ingen ny app-container blev oprettet (uændret release?) — intet at skifte"
  "${COMPOSE[@]}" up -d db migrate app scan-app edge-proxy
  exit 0
fi

# 4) Vent på, at den nye container er sund (op til 3 minutter).
log "Venter på, at den nye container bliver sund"
healthy=false
for _ in $(seq 1 90); do
  status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' $new_ids | sort -u | tr '\n' ' ')"
  if [ "$status" = "healthy " ]; then healthy=true; break; fi
  if [ "$status" = "unhealthy " ]; then break; fi
  sleep 2
done
if [ "$healthy" != true ]; then
  log "Den nye container blev ikke sund (status: ${status:-ukendt}) — fjerner den og beholder den gamle"
  docker logs --tail 40 $new_ids || true
  docker stop $new_ids >/dev/null || true
  docker rm $new_ids >/dev/null || true
  exit 1
fi

# 5) Skift: stop og fjern den gamle (nginx prøver næste adresse for forbindelser, der ramte den).
log "Ny container er sund — stopper den gamle"
docker stop -t 30 $old_ids >/dev/null
docker rm $old_ids >/dev/null

# 6) Sørg for, at resten af stakken svarer til compose-filen (uændrede services røres ikke).
"${COMPOSE[@]}" up -d db migrate app scan-app edge-proxy
log "Færdig"
