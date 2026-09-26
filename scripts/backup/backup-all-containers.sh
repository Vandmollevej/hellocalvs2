#!/bin/bash
# Backup af alle containere på Synology.
#
#   ssh -t Peter@192.168.1.90 "sudo bash /volume1/docker/App/hellocal-v2/scripts/backup-all-containers.sh"
#
# Deployet kopierer denne fil til /deploy/scripts/ (= /volume1/docker/App/hellocal-v2/scripts/).
#
# Hvad den gør:
#   - Databaser dumpes (pg_dumpall / mysqldump). Deres rå datamapper kopieres
#     ikke, fordi en kopi af en kørende database ikke er til at stole på.
#   - Hver bind-/volume-mappe kopieres præcis én gang, også selv om flere
#     containere mounter den. En mappe, der indeholder andre mounts (fx
#     runnerens /deploy = hele hellocal-v2), kopieres ikke; dens
#     konfigurationsfiler tages med under "Stack config".
#   - Uændrede filer hardlinkes til forrige backup (rsync --link-dest), så en
#     ny backup kun fylder det, der er ændret siden sidst.
#   - Docker-images gemmes kun med --with-images (de kan hentes fra GHCR eller
#     bygges fra repoet igen).
set -uo pipefail

BACKUP_ROOT="${BACKUP_ROOT:-/volume1/docker/App/backups}"
STACK_DIRS=(/volume1/docker/App/hellocal-v2 /volume1/docker/App/hellocal)
WITH_IMAGES=0
[ "${1:-}" = "--with-images" ] && WITH_IMAGES=1

DOCKER="$(command -v docker || echo /usr/local/bin/docker)"
STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="$BACKUP_ROOT/containers-$STAMP"
PREV="$(ls -1d "$BACKUP_ROOT"/containers-* 2>/dev/null | sort | tail -n 1)"
HAS_RSYNC=0
command -v rsync >/dev/null && HAS_RSYNC=1

log() { echo "[$(date +%H:%M:%S)] $*"; }
mb() { du -sm "$1" 2>/dev/null | cut -f1; }

# Kopiér mappe $1 til $DEST/$2. Hardlinker uændrede filer mod forrige backup.
copy_dir() {
  local src="$1" rel="$2" target="$DEST/$2"
  shift 2
  mkdir -p "$target"
  if [ "$HAS_RSYNC" = 1 ]; then
    local link=()
    [ -n "$PREV" ] && [ -d "$PREV/$rel" ] && link=(--link-dest="$PREV/$rel")
    rsync -a --delete "${link[@]}" "$@" "$src/" "$target/" 2>&1 | grep -v "^$" || true
  else
    cp -a "$src/." "$target/"
  fi
}

mkdir -p "$DEST" || { echo "Kan ikke oprette $DEST"; exit 1; }
log "Backup to $DEST"
[ -n "$PREV" ] && [ "$HAS_RSYNC" = 1 ] && log "Uændrede filer deles med $PREV"

CONTAINERS="$("$DOCKER" ps --format '{{.Names}}' | sort)"

# 1) Databaser
SKIP_DIRS=()
for c in $CONTAINERS; do
  image="$("$DOCKER" inspect -f '{{.Config.Image}}' "$c")"
  case "$image" in
    *postgres*)
      user="$("$DOCKER" exec "$c" sh -c 'echo "${POSTGRES_USER:-postgres}"')"
      log "pg_dumpall from $c (user $user)"
      out="$DEST/db/$c.sql.gz"
      mkdir -p "$DEST/db"
      if "$DOCKER" exec "$c" pg_dumpall -U "$user" | gzip > "$out" && [ -s "$out" ]; then
        log "  $(du -h "$out" | cut -f1)"
        SKIP_DIRS+=("$("$DOCKER" inspect -f '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Source}}{{end}}{{end}}' "$c")")
      else
        log "  FEJL: dump mislykkedes, datamappen kopieres i stedet"
      fi
      ;;
    *mysql*|*mariadb*)
      log "mysqldump from $c"
      out="$DEST/db/$c.sql.gz"
      mkdir -p "$DEST/db"
      if "$DOCKER" exec "$c" sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --all-databases --single-transaction --quick 2>/dev/null' | gzip > "$out" \
        && [ "$(gzip -dc "$out" | head -c 1 | wc -c)" -gt 0 ]; then
        log "  $(du -h "$out" | cut -f1)"
        SKIP_DIRS+=("$("$DOCKER" inspect -f '{{range .Mounts}}{{if eq .Destination "/var/lib/mysql"}}{{.Source}}{{end}}{{end}}' "$c")")
      else
        rm -f "$out"
        log "  mysqldump mislykkedes, datamappen kopieres i stedet"
      fi
      ;;
  esac
done

# 2) Stack-konfiguration (compose, .env, scripts) uden data og backups
for dir in "${STACK_DIRS[@]}"; do
  [ -d "$dir" ] || continue
  log "Stack config: $dir/"
  rel="stacks/$(basename "$dir")"
  if [ "$HAS_RSYNC" = 1 ]; then
    copy_dir "$dir" "$rel" --exclude='/data/' --exclude='/backups/' --exclude='/_work/' --exclude='node_modules/'
  else
    mkdir -p "$DEST/$rel"
    find "$dir" -maxdepth 1 -type f -exec cp -a {} "$DEST/$rel/" \;
  fi
done

# 3) Mounts — hver mappe én gang
MOUNTS="$(for c in $CONTAINERS; do
  "$DOCKER" inspect -f '{{range .Mounts}}{{.Source}}|'"$c"'|{{.Destination}}|{{.Type}}{{"\n"}}{{end}}' "$c"
done | grep -v '^$' | grep -v '^/var/run/docker.sock|' | sort -t'|' -k1,1 -u)"
ALL_SOURCES="$(echo "$MOUNTS" | cut -d'|' -f1)"

while IFS='|' read -r src c dst type; do
  [ -n "$src" ] && [ -d "$src" ] || continue
  skip=""
  for s in "${SKIP_DIRS[@]}"; do [ "$src" = "$s" ] && skip="dumpet som database"; done
  # Mappen indeholder andre mounts → de tages hver for sig; config under Stack config.
  if [ -z "$skip" ] && echo "$ALL_SOURCES" | awk -v p="$src/" 'index($0, p) == 1 { f = 1 } END { exit !f }'; then
    skip="indeholder andre mounts, springes over"
  fi
  if [ -n "$skip" ]; then
    log "  $c: $src ($skip)"
    continue
  fi
  log "  $c: $type $src -> $dst ($(mb "$src") MB)"
  copy_dir "$src" "mounts${src}"
done <<< "$MOUNTS"

# 4) Docker-images (valgfrit)
if [ "$WITH_IMAGES" = 1 ]; then
  mkdir -p "$DEST/images"
  for img in $("$DOCKER" ps --format '{{.Image}}' | sort -u | grep -Ei 'hellocal'); do
    log "docker save $img"
    "$DOCKER" save "$img" | gzip > "$DEST/images/$(echo "$img" | tr '/:' '__').tar.gz"
  done
fi

# du tæller hardlinks én gang pr. kald, så med forrige backup først er sidste linje den nye plads.
if [ -n "$PREV" ]; then
  log "Size: $(du -sh "$PREV" "$DEST" | tail -n 1 | cut -f1) ny plads (resten deles med $(basename "$PREV"))"
else
  log "Size: $(du -sh "$DEST" | cut -f1)"
fi
EMPTY="$(find "$DEST/db" -type f -size -40c 2>/dev/null)"
if [ -n "$EMPTY" ]; then
  log "Empty files (check these):"
  echo "$EMPTY"
fi
log "DONE: $DEST"
