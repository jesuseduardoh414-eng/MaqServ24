#!/bin/bash
# RESPALDO DE MAQSER24 EN cPANEL (2026-10-05).
#
# Hasta hoy no había ningún respaldo: ni de la base ni de las fotos.
# Este script vive en ~/bin/respaldo.sh y lo corre el cron todos los días.
#
#  - Base de datos: TODOS LOS DÍAS, comprimida, 14 días de historia.
#    Necesita ~/.my.cnf (permisos 600) con el usuario de la base:
#        [client]
#        user=maqserv24_app
#        password=LA_CONTRASEÑA
#    Sin ese archivo no respalda la base y lo deja anotado en el registro.
#  - Fotos (~/media): los DOMINGOS (y la primera vez), 4 semanas de historia.
#
# Todo queda en ~/respaldos, FUERA de cualquier carpeta pública. Es un
# respaldo en el mismo servidor: protege de un borrado o un error, no de
# perder el servidor. Para eso, descargar de vez en cuando la copia más
# reciente (o activar los respaldos automáticos del hosting).
set -u
DEST="$HOME/respaldos"
LOG="$DEST/respaldo.log"
BD="maqserv24_db"
HOY="$(date +%F)"
mkdir -p "$DEST/bd" "$DEST/media"
chmod 700 "$DEST"

if [ -f "$HOME/.my.cnf" ]; then
  if mysqldump --defaults-file="$HOME/.my.cnf" --single-transaction --routines --no-tablespaces "$BD" \
      | gzip > "$DEST/bd/$BD-$HOY.sql.gz.tmp"; then
    mv "$DEST/bd/$BD-$HOY.sql.gz.tmp" "$DEST/bd/$BD-$HOY.sql.gz"
    echo "$HOY base ok ($(du -h "$DEST/bd/$BD-$HOY.sql.gz" | cut -f1))" >> "$LOG"
  else
    rm -f "$DEST/bd/$BD-$HOY.sql.gz.tmp"
    echo "$HOY ERROR al respaldar la base" >> "$LOG"
  fi
else
  echo "$HOY sin ~/.my.cnf: la base NO se respaldó" >> "$LOG"
fi

if [ "$(date +%u)" = "7" ] || ! ls "$DEST"/media/*.tar.gz >/dev/null 2>&1; then
  if tar -czf "$DEST/media/media-$HOY.tar.gz.tmp" -C "$HOME" media; then
    mv "$DEST/media/media-$HOY.tar.gz.tmp" "$DEST/media/media-$HOY.tar.gz"
    echo "$HOY fotos ok ($(du -h "$DEST/media/media-$HOY.tar.gz" | cut -f1))" >> "$LOG"
  else
    rm -f "$DEST/media/media-$HOY.tar.gz.tmp"
    echo "$HOY ERROR al respaldar las fotos" >> "$LOG"
  fi
fi

find "$DEST/bd" -name '*.sql.gz' -mtime +14 -delete
find "$DEST/media" -name '*.tar.gz' -mtime +28 -delete
