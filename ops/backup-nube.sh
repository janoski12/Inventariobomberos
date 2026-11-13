#!/bin/bash
# Sincroniza (cifrado) los backups de la base de datos y los documentos
# firmados (actas) hacia Google Drive. Corre en el HOST via cron (ver
# README de este directorio), ejecutando rclone DENTRO del contenedor,
# donde rclone y su config viven en el volumen persistente
# /app/backend/data/_rclone (sobreviven a "docker compose up --build").
#
# Si alguno de los dos sync falla, avisa por correo a la cuenta "admin"
# (backend/lib/alertas.js + backend/scripts/alertar_backup_fallido.js),
# reusando el SMTP ya configurado para recuperación de contraseña.
set -o pipefail

CONTAINER="inventario-bomberos"
RCLONE_BIN="/app/backend/data/_rclone/rclone"
RCLONE_CFG="/app/backend/data/_rclone/rclone.conf"
LOG="/app/backend/data/_rclone/sync.log"
CRONLOG="$HOME/backup-nube-cron.log"

run() {
    docker exec "$CONTAINER" "$RCLONE_BIN" --config "$RCLONE_CFG" --log-file "$LOG" --log-level INFO "$@"
}

echo "$(date '+%Y-%m-%d %H:%M:%S') --- inicio backup a la nube ---" >> "$CRONLOG"

run sync /app/backend/data/backups cryptdrive:db
EXIT_DB=$?

run sync /app/backend/data/documentos cryptdrive:documentos
EXIT_DOCS=$?

if [ $EXIT_DB -ne 0 ] || [ $EXIT_DOCS -ne 0 ]; then
    DETALLE="db=$EXIT_DB documentos=$EXIT_DOCS (ver $LOG dentro del contenedor)"
    echo "$(date '+%Y-%m-%d %H:%M:%S') FALLO: $DETALLE" >> "$CRONLOG"
    docker exec -w /app/backend "$CONTAINER" node scripts/alertar_backup_fallido.js "$DETALLE" >> "$CRONLOG" 2>&1
    exit 1
fi

echo "$(date '+%Y-%m-%d %H:%M:%S') OK" >> "$CRONLOG"
exit 0
