#!/usr/bin/env bash
# Aplica la configuración de CORS del bucket de medios y comprueba que quedó puesta.
#
# POR QUÉ EXISTE ESTE SCRIPT
# --------------------------
# Una descarga en la PWA es un `fetch` a la URL canónica del mismo origen
# (`/media/**`), que la API responde con un 302 hacia una URL firmada en
# `storage.googleapis.com`. El redirect cruza de origen, así que el navegador
# exige `Access-Control-Allow-Origin` en la respuesta final: sin CORS en el
# bucket, `fetch` rechaza con TypeError y la app dice "No se pudo conectar para
# descargar el archivo" sin más detalle. No hay forma de arreglarlo desde el
# código de la app — la cabecera la tiene que mandar Cloud Storage.
#
# Estaba documentado en DESPLIEGUE.md como un paso manual y con el origen
# equivocado, que es exactamente cómo se perdió. Vive aquí para que se pueda
# volver a correr y para que el origen sea el mismo que el de Hosting.
#
#   ./scripts/set-media-cors.sh
#   GCS_BUCKET=otro-bucket ./scripts/set-media-cors.sh
set -euo pipefail

BUCKET="${GCS_BUCKET:-explorarte-6335b-media}"
CONFIG="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/infra/gcs-media-cors.json"

command -v gcloud >/dev/null || { echo "falta gcloud en el PATH" >&2; exit 1; }
[ -f "$CONFIG" ] || { echo "no existe $CONFIG" >&2; exit 1; }

echo "Aplicando CORS sobre gs://$BUCKET"
gcloud storage buckets update "gs://$BUCKET" --cors-file="$CONFIG"

echo
echo "Configuración efectiva:"
gcloud storage buckets describe "gs://$BUCKET" --format="value(cors_config)"

cat <<'NOTA'

Para verificarlo de extremo a extremo, con la app ya desplegada:

  URL=$(curl -s -o /dev/null -D - "https://explorarte-6335b.web.app/media/tools/<archivo>" \
        | sed -n 's/^[Ll]ocation: //p' | tr -d '\r')
  curl -sI -H "Origin: https://explorarte-6335b.web.app" "$URL" | grep -i access-control

La última línea tiene que imprimir Access-Control-Allow-Origin. Si no imprime
nada, el bucket sigue sin CORS y las descargas seguirán fallando.
NOTA
