#!/usr/bin/env bash
#
# GCP-04 — copia los objetos de Supabase Storage al bucket de Cloud Storage for
# Firebase, conservando exactamente la misma ruta dentro del bucket
# (<categoria>/<uuid>-<archivo>). Esa igualdad de rutas es a proposito: hace que
# la migracion de las URLs guardadas en la base sea una sustitucion de prefijo
# (scripts/migrate-media-urls.sql) y no un mapeo objeto por objeto.
#
# Es idempotente y NO borra nada del lado de Supabase: se puede correr las veces
# que haga falta, y Supabase queda intacto como plan de vuelta atras.
#
# Uso:
#   export SUPABASE_URL=https://<ref>.supabase.co
#   export SUPABASE_KEY=<service_role key>     # solo para leer, y solo hoy
#   export GCS_BUCKET=explorarte-prod.firebasestorage.app
#   ./scripts/migrate-storage-to-gcs.sh              # copia de verdad
#   DRY_RUN=1 ./scripts/migrate-storage-to-gcs.sh    # solo lista que haria
#
# Requiere: bash, curl, jq, gcloud (autenticado con permiso de escritura en el
# bucket). En Windows correr desde Git Bash o WSL.

set -euo pipefail

: "${SUPABASE_URL:?falta SUPABASE_URL}"
: "${SUPABASE_KEY:?falta SUPABASE_KEY}"
: "${GCS_BUCKET:?falta GCS_BUCKET}"

BUCKET_SUPABASE="${BUCKET_SUPABASE:-explorarte-media}"
DRY_RUN="${DRY_RUN:-}"

# Los mismos prefijos que MediaCategory.storagePrefix(). Si se agrega una
# categoria en el enum, hay que agregarla aqui.
PREFIXES=(tools emotions learning screen-intros posts profile)

copied=0
skipped=0
failed=0

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

for prefix in "${PREFIXES[@]}"; do
  echo "== $prefix"

  # La API de listado de Supabase Storage pagina de 100 en 100.
  offset=0
  while :; do
    body=$(printf '{"prefix":"","limit":100,"offset":%d,"sortBy":{"column":"name","order":"asc"}}' "$offset")
    names=$(curl -sS -X POST \
      "$SUPABASE_URL/storage/v1/object/list/$BUCKET_SUPABASE/$prefix" \
      -H "Authorization: Bearer $SUPABASE_KEY" \
      -H "apikey: $SUPABASE_KEY" \
      -H "Content-Type: application/json" \
      -d "$body" | jq -r '.[]? | select(.id != null) | .name')

    [ -z "$names" ] && break

    while IFS= read -r name; do
      [ -z "$name" ] && continue
      object="$prefix/$name"

      # Idempotencia: si ya esta del otro lado, no se vuelve a subir.
      if gcloud storage objects describe "gs://$GCS_BUCKET/$object" >/dev/null 2>&1; then
        echo "  = $object (ya estaba)"
        skipped=$((skipped + 1))
        continue
      fi

      if [ -n "$DRY_RUN" ]; then
        echo "  + $object (dry run)"
        copied=$((copied + 1))
        continue
      fi

      local_file="$tmp/obj"
      # El bucket de Supabase es de lectura publica hoy, pero se descarga
      # autenticado igual: asi este script sigue funcionando si alguien cierra
      # el bucket antes de terminar la migracion.
      if ! curl -sS -f -o "$local_file" \
          "$SUPABASE_URL/storage/v1/object/$BUCKET_SUPABASE/$object" \
          -H "Authorization: Bearer $SUPABASE_KEY" \
          -H "apikey: $SUPABASE_KEY"; then
        echo "  ! $object (no se pudo descargar)" >&2
        failed=$((failed + 1))
        continue
      fi

      # --cache-control repite lo que pone GcsMediaStorageClient en las subidas
      # nuevas: la ruta lleva un UUID, asi que los bytes de una ruta no cambian.
      # --content-type se deduce del archivo; si sale mal, el sniffer del API ya
      # rechazo cualquier cosa rara al subirla en su momento.
      if gcloud storage cp "$local_file" "gs://$GCS_BUCKET/$object" \
          --cache-control="public, max-age=31536000, immutable" \
          --quiet; then
        echo "  + $object"
        copied=$((copied + 1))
      else
        echo "  ! $object (no se pudo subir)" >&2
        failed=$((failed + 1))
      fi
    done <<< "$names"

    offset=$((offset + 100))
  done
done

echo
echo "Copiados: $copied   Ya estaban: $skipped   Fallidos: $failed"
[ "$failed" -eq 0 ] || exit 1

cat <<'SIGUIENTE'

Siguiente paso: reescribir las URLs guardadas en la base con
scripts/migrate-media-urls.sql. Hasta que eso corra, la base sigue apuntando a
Supabase y los clientes siguen leyendo de alli — el corte es esa consulta, no
esta copia.
SIGUIENTE
