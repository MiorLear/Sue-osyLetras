# Despliegue — runbook único

**Producción es Google Cloud. Render es desarrollo/staging.** Esas dos frases son la respuesta a
MAINT-15 y este documento es la fuente autoritativa; si algo en otro archivo las contradice, lo
que está mal es el otro archivo.

| Entorno | Dónde | Para qué |
|---|---|---|
| **Producción** | Firebase Hosting + Cloud Run + Cloud SQL + Cloud Storage for Firebase | Lo que usan las docentes. Dominio propio, sin límite de 30 días en la base, arranque en frío de segundos y no de minuto y medio. |
| **Desarrollo / staging** | Render (`render.yaml`) + Supabase Postgres | Backend compartido del equipo, para que mobile no dependa de túneles ni de que la laptop de alguien esté prendida (ver [`COMO-EMPEZAR.md`](./COMO-EMPEZAR.md)). **Se mantiene al día a propósito.** No está abandonado ni es aspiracional. |
| **Local** | `docker compose up` | Tu máquina. |

> **Estado: nada de esto está desplegado todavía.** Este batch dejó el código portable y este
> runbook verificado, pero no se creó ningún recurso en Google Cloud, no se movió ningún dato y no
> se pidió ninguna credencial. Lo que sigue es el paso a paso para el día que se ejecute, con lo
> que hay que hacer a mano marcado como tal.

---

## 1. Qué va dónde

| Pieza | Servicio | Por qué |
|---|---|---|
| **Web** (`web/`) | **Firebase Hosting** | Sitio estático (build de Vite) — el caso clásico de Hosting. |
| **API** (`api/`) | **Cloud Run** | Hosting no ejecuta Java. Cloud Run corre el mismo contenedor que ya existe (`api/Dockerfile`, target `prod`), y Hosting puede enrutar tráfico hacia él. |
| **Base de datos** | **Cloud SQL for PostgreSQL** | Firestore es NoSQL; reescribir el esquema/JPA sería otro proyecto. Cloud SQL es Postgres real y vive en el mismo proyecto de Google Cloud. |
| **Archivos** (fotos, PDFs, videos) | **Cloud Storage for Firebase** | Cloud Run es efímero. Ver §5, que es la sección más importante de este documento para quien construya la caché de medios. |
| **Mobile** (`src/`) | *No se hospeda* | Se publica con EAS Build/Submit. Ver §10. |

Lo que ya está en el código para que esto funcione sin tocar nada más:

- `api/Dockerfile` tiene un target `prod` que compila el jar y lo corre en una imagen liviana.
- `application.yml` usa `server.port: ${PORT:8000}`; Cloud Run inyecta `PORT`.
- **GCP-01:** `com.google.cloud.sql:postgres-socket-factory` ya está en `api/pom.xml`. El mismo jar
  se conecta a los tres entornos sin ninguna rama en el código — solo cambia el valor de
  `SPRING_DATASOURCE_URL`:

  | Entorno | `SPRING_DATASOURCE_URL` |
  |---|---|
  | docker-compose | `jdbc:postgresql://db:5432/explorarte` |
  | Render | *no se setea* — se setea `DATABASE_URL` y `RenderDatabaseUrlEnvironmentPostProcessor` la traduce |
  | Cloud SQL | `jdbc:postgresql:///explorarte?cloudSqlInstance=<PROJECT>:<REGION>:<INSTANCE>&socketFactory=com.google.cloud.sql.postgres.SocketFactory` |

  La forma de Cloud SQL no lleva host ni puerto: el driver le entrega la conexión al socket
  factory, que abre el túnel TLS por su cuenta.

  > ⚠️ **No setees `DATABASE_URL` en Cloud Run.** Tiene precedencia sobre `SPRING_DATASOURCE_URL`
  > (`RenderDatabaseUrlEnvironmentPostProcessor` corre con `HIGHEST_PRECEDENCE`), así que una
  > variable olvidada de una prueba anterior manda el tráfico de producción a la base de staging
  > sin decir nada.

- **GCP-04:** el almacenamiento ya es Cloud Storage, no Supabase. `SUPABASE_URL` y `SUPABASE_KEY`
  no existen como variables del backend.

---

## 2. Antes de empezar

- Cuenta de Google con facturación habilitada. **Cloud Run y Cloud SQL no están en el plan Spark**
  de Firebase; hace falta Blaze (sigue teniendo capa gratuita, pero pide tarjeta).
- `gcloud` CLI — [cloud.google.com/sdk](https://cloud.google.com/sdk)
- `firebase-tools`: `npm install -g firebase-tools`
- `psql` y `pg_dump` (para la migración de datos, §7).
- Decidir: nombre del proyecto, región y presupuesto. Este runbook usa `explorarte-prod` y
  `us-central1`; cámbialos de forma consistente.

```bash
export PROJECT_ID=explorarte-prod
export REGION=us-central1
export INSTANCE=explorarte-db
export SERVICE=explorarte-api
```

---

## 3. Crear el proyecto, la base y el bucket

```bash
firebase login
firebase projects:create "$PROJECT_ID"
gcloud config set project "$PROJECT_ID"

gcloud services enable run.googleapis.com sqladmin.googleapis.com \
  secretmanager.googleapis.com artifactregistry.googleapis.com \
  cloudbuild.googleapis.com storage.googleapis.com iamcredentials.googleapis.com
```

Un proyecto de Firebase **es** un proyecto de Google Cloud; todo lo que sigue usa el mismo.

### Base de datos

```bash
gcloud sql instances create "$INSTANCE" \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region="$REGION"

gcloud sql databases create explorarte --instance="$INSTANCE"
gcloud sql users set-password postgres --instance="$INSTANCE" --password=<contraseña-real-segura>
```

`db-f1-micro` es el tier más chico. Se escala después sin tocar código.

### Bucket de medios

Cloud Storage for Firebase es un bucket de GCS normal. Se crea desde la consola de Firebase
(Storage → Comenzar), lo que deja un bucket llamado `explorarte-prod.firebasestorage.app`.

```bash
export GCS_BUCKET="$PROJECT_ID.firebasestorage.app"
```

**El bucket queda privado y así se queda.** No le agregues un binding de `allUsers`. Ese binding
es exactamente lo que hacía que cualquier archivo subido fuera legible por internet para siempre
(SEC-11), y el diseño de §5 no lo necesita: nadie lee del bucket directamente.

Si la PWA va a cachear medios con el service worker, el bucket necesita CORS para el origen de
Hosting (ver §5, "Lo que hace falta del lado de Firebase Hosting"):

```bash
cat > /tmp/cors.json <<'JSON'
[{"origin": ["https://explorarte-prod.web.app"],
  "method": ["GET", "HEAD"],
  "responseHeader": ["Content-Type", "Content-Length"],
  "maxAgeSeconds": 3600}]
JSON
gcloud storage buckets update "gs://$GCS_BUCKET" --cors-file=/tmp/cors.json
```

---

## 4. Secretos (GCP-02)

### ⚠️ **Crea `JWT_SECRET` en Secret Manager ANTES del primer `gcloud run deploy`. Si no existe, el primer despliegue no arranca.**

Esto no es una precaución teórica. La Ola 1 (SEC-03) quitó el valor por defecto de `app.jwt.secret`
a propósito: `JwtService` rechaza una clave vacía, conocida o de menos de 32 bytes, y **aborta el
arranque**. En Cloud Run un contenedor que no responde al health check se marca como despliegue
fallido y el tráfico se queda en la revisión anterior — que en el primer despliegue no existe. El
síntoma es un deploy que falla con "the user-provided container failed to start and listen on the
port", y la causa está en los logs de arranque, no en el mensaje de Cloud Run.

**`render.yaml:41-42` usa `JWT_SECRET: generateValue: true`. Eso no tiene equivalente en Cloud
Run.** Render genera el valor al crear el servicio; Cloud Run no genera nada, hay que crear el
secreto antes y montarlo.

```bash
# 1. Crear los secretos. NO se versionan y NO se pasan por --set-env-vars.
printf '%s' "$(openssl rand -base64 48)" | \
  gcloud secrets create JWT_SECRET --data-file=- --replication-policy=automatic

printf '%s' '<contraseña-real-de-cloud-sql>' | \
  gcloud secrets create DB_PASSWORD --data-file=- --replication-policy=automatic

# 2. Dejar que la service account de Cloud Run los lea.
export RUNTIME_SA="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')-compute@developer.gserviceaccount.com"

for s in JWT_SECRET DB_PASSWORD; do
  gcloud secrets add-iam-policy-binding "$s" \
    --member="serviceAccount:$RUNTIME_SA" \
    --role=roles/secretmanager.secretAccessor
done
```

Comprobación antes de seguir — si esto no imprime el secreto, el deploy va a fallar:

```bash
gcloud secrets versions access latest --secret=JWT_SECRET
```

### El otro permiso que no es obvio: firmar URLs

Las credenciales por defecto en Cloud Run **no tienen clave privada**, así que la librería de
Storage no puede firmar localmente: llama a la API de IAM `signBlob` haciéndose pasar por sí
misma. Eso exige que la service account tenga `roles/iam.serviceAccountTokenCreator` **sobre sí
misma**. Sin ese permiso las subidas funcionan y **todas las lecturas fallan** — un modo de fallo
particularmente confuso, porque el bucket está bien y el archivo está ahí.

```bash
gcloud storage buckets add-iam-policy-binding "gs://$GCS_BUCKET" \
  --member="serviceAccount:$RUNTIME_SA" --role=roles/storage.objectAdmin

# El "sobre sí misma" es literal: es a la vez el recurso y el miembro.
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" \
  --member="serviceAccount:$RUNTIME_SA" --role=roles/iam.serviceAccountTokenCreator
```

### Qué es secreto y qué no

| Variable | Cómo se pasa | Por qué |
|---|---|---|
| `JWT_SECRET` | `--set-secrets` | Firma los tokens. Quien la tenga es admin. |
| `SPRING_DATASOURCE_PASSWORD` | `--set-secrets` (`DB_PASSWORD`) | Acceso total a la base. |
| `SEED_USER_PASSWORD` | **no se setea** | Sin ella el seeder no crea ninguna cuenta (SEC-02). En producción se deja fuera. |
| `RESEND_API_KEY` | `--set-secrets` si se usa correo | Permite enviar correo como el dominio del proyecto. |
| `GCS_BUCKET`, `APP_MEDIA_*`, `APP_CORS_ALLOWED_ORIGINS`, `JWT_EXPIRATION_MINUTES` | `--set-env-vars` | No son secretos. |
| *(ninguna llave de storage)* | — | **Ya no existe.** GCP-04 quitó `SUPABASE_KEY`; las credenciales de Storage son la propia identidad del servicio. |

---

## 5. La forma de las URLs de medios

**Esta sección es un contrato.** El Lote 7 va a construir la caché de medios de la PWA encima, y
el índice de medios del Lote 6 (PR #29) es compartido entre docentes a propósito.

### La forma exacta

Hay **dos** URLs y **solo una se guarda**:

```
CANÓNICA — se persiste, es permanente, no tiene query string, no caduca
  https://explorarte-prod.web.app/media/posts/9f1c8e2a-...-ficha.pdf
  └── APP_MEDIA_PUBLIC_BASE_URL ──┘└──── ruta del objeto en el bucket ────┘

    GET → 302 Found, Location:

FIRMADA — efímera, no se guarda nunca, no es clave de caché de nadie
  https://storage.googleapis.com/explorarte-prod.firebasestorage.app/posts/9f1c8e2a-...-ficha.pdf
    ?X-Goog-Algorithm=GOOG4-RSA-SHA256
    &X-Goog-Credential=<sa>%2F20260807%2Fauto%2Fstorage%2Fgoog4_request
    &X-Goog-Date=20260807T090000Z
    &X-Goog-Expires=900
    &X-Goog-SignedHeaders=host
    &X-Goog-Signature=<hex>
```

Lo que se guarda en `posts.attachments`, `users.photo`, `screen_intro_videos.video`,
`tools_content.*`, `emotion_content.stories` y `topic_subtopics.*` es **siempre la canónica**. Lo
que devuelve `POST /media/upload` es **siempre la canónica**. Lo que una docente tiene en su
caché offline es **siempre la canónica**.

### ¿Caducan? Sí y no, y la distinción es el diseño

- **La URL que el cliente conoce no caduca nunca.** No tiene firma. Nunca deja de ser válida.
- **La firma caduca a los 15 minutos** (`GCS_SIGNED_URL_TTL_SECONDS`), pero solo existe dentro de
  un `Location` que nadie guarda.

### Cómo se renuevan sin romper una descarga offline ya hecha

**No hay nada que renovar.** Un archivo descargado son bytes en el disco del teléfono; la
caducidad se aplica a la *descarga*, no al *archivo*. Un teléfono que lleva tres semanas sin red
sigue abriendo el PDF que bajó, porque nadie va a volver a pedirle una firma a nadie. Y la próxima
vez que ese teléfono tenga red y quiera refrescar, pide la misma URL canónica de siempre y recibe
una firma nueva. No hace falta un job de renovación, ni un refresco en segundo plano, ni que el
cliente sepa que existen las firmas.

Esto es exactamente lo que evita el fallo que preocupaba: si la URL firmada fuera la URL guardada,
el índice de medios compartido se invalidaría solo, cada docente tendría una entrada distinta para
el mismo archivo, y las descargas offline se romperían en silencio a una fecha que nadie apuntó.

### Cómo se revoca un archivo concreto

Borrar el objeto:

```bash
gcloud storage rm "gs://$GCS_BUCKET/posts/9f1c8e2a-...-ficha.pdf"
```

`MediaAccessController` consulta el objeto antes de firmar, así que a partir del request siguiente
la URL canónica responde 404. Esta es la ventaja concreta sobre la alternativa de "lectura pública
con nombres imposibles de adivinar": con una URL pública, borrar el objeto deja vivas todas las
copias en CDN y navegadores y no hay ningún punto donde cortar. Aquí el punto de corte es la API, y
corta en un request.

Lo que **no** revoca: una copia ya descargada en un teléfono. Ningún diseño de URL puede hacer eso.

### Lo que sigue abierto, dicho claro

`GET /media/**` no pide token hoy, porque `<img src>` y `<video src>` no pueden mandar la cabecera
`Authorization` y ambos clientes pintan los adjuntos así. O sea que la URL canónica es una
*capability*: imposible de adivinar (lleva un UUID v4) pero no autenticada. Está a un interruptor:
`APP_MEDIA_REQUIRE_AUTH_FOR_PRIVATE=true` exige sesión para las categorías `posts` y `profile` (las
de contenido de docentes; el material publicado por admin queda abierto porque los endpoints que
reparten sus URLs ya son `permitAll`). El interruptor está cableado y probado
(`MediaAccessControllerTest`); va apagado para no romper pantallas que son de otro lote. Encenderlo
va en la misma release en que los clientes dejen de asignar la URL directo a `src`.

### Lo que hace falta del lado de Firebase Hosting

> 📌 **Para quien mantiene `web/firebase.json` (Lote 5) — este runbook necesita que ese archivo
> tenga un rewrite de `/media/**` hacia el mismo servicio de Cloud Run que ya tiene `/api/**`.**
> No lo edité porque no es mío.

```jsonc
// web/firebase.json → hosting.rewrites, junto al de /api/**
{ "source": "/media/**", "run": { "serviceId": "explorarte-api", "region": "us-central1" } }
```

> 📌 **Y la CSP de ese mismo archivo necesita `https://storage.googleapis.com` en `img-src` y
> `media-src`.** Una URL de medios responde 302 hacia Cloud Storage, y **la CSP se aplica a la URL
> final de la redirección, no a la inicial**. Sin esa entrada, las fotos de perfil y los videos se
> rompen en silencio: no hay error de red, solo una violación en la consola del navegador. Ya está
> aplicado en el espejo de `render.yaml`, de donde se puede copiar la forma exacta. Los
> `https://*.supabase.co` que hay hoy se pueden quitar cuando termine §7.

Sin ese rewrite, `APP_MEDIA_PUBLIC_BASE_URL` tiene que apuntar a la URL directa de Cloud Run
(`https://explorarte-api-xxxx.run.app`) y los medios quedan en otro origen que la PWA — con lo que
el service worker no los puede enrutar y hace falta CORS también en Cloud Run, no solo en el
bucket. Funciona, pero es la opción peor.

### El costo, dicho claro

Cada fetch de un medio paga un ida y vuelta a la API antes de llegar al byte (una lectura de
metadatos en Cloud Storage más una llamada a IAM `signBlob`). Los bytes **no** pasan por Cloud
Run. El 302 se puede cachear `APP_MEDIA_REDIRECT_CACHE_SECONDS` (300 s por defecto), y la API se
niega a arrancar si ese valor pudiera sobrevivir a la firma que entrega.

---

## 6. Desplegar

### 6.1 Backend → Cloud Run

```bash
cd api
gcloud builds submit --tag "$REGION-docker.pkg.dev/$PROJECT_ID/explorarte/api"

gcloud run deploy "$SERVICE" \
  --image "$REGION-docker.pkg.dev/$PROJECT_ID/explorarte/api" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --add-cloudsql-instances "$PROJECT_ID:$REGION:$INSTANCE" \
  --service-account "$RUNTIME_SA" \
  --memory 1Gi --cpu 1 --cpu-boost \
  --min-instances 0 --max-instances 4 \
  --set-secrets "JWT_SECRET=JWT_SECRET:latest,SPRING_DATASOURCE_PASSWORD=DB_PASSWORD:latest" \
  --set-env-vars "SPRING_DATASOURCE_URL=jdbc:postgresql:///explorarte?cloudSqlInstance=$PROJECT_ID:$REGION:$INSTANCE&socketFactory=com.google.cloud.sql.postgres.SocketFactory" \
  --set-env-vars "SPRING_DATASOURCE_USERNAME=postgres" \
  --set-env-vars "JWT_EXPIRATION_MINUTES=1440" \
  --set-env-vars "GCS_BUCKET=$GCS_BUCKET" \
  --set-env-vars "APP_MEDIA_PUBLIC_BASE_URL=https://$PROJECT_ID.web.app" \
  --set-env-vars "APP_CORS_ALLOWED_ORIGINS=https://$PROJECT_ID.web.app"
```

Notas sobre esos flags:

- `--allow-unauthenticated` es correcto: la autenticación la hace la propia API con JWT. Si se
  pone lo contrario, Hosting no puede enrutar hacia el servicio.
- `SEED_USER_PASSWORD` **no aparece**. Sin ella el seeder no crea cuentas y producción no queda con
  un ADMIN de contraseña conocida (SEC-02).
- `--cpu-boost` da CPU extra durante el arranque. Ver §8.
- `--max-instances 4` es un tope de gasto además de uno de escala: sin él, un pico de tráfico (o un
  bucle en un cliente) puede escalar hasta el límite de la cuota.

### 6.2 Web → Firebase Hosting

```bash
cd web
npm run build            # genera web/dist
firebase deploy --only hosting --project "$PROJECT_ID"
```

El rewrite de `/api/**` (y el de `/media/**`, ver §5) hace que web y API compartan dominio y no
haya CORS entre ellos.

### 6.3 Verificar

```bash
curl -sf "https://$PROJECT_ID.web.app/api/actuator/health"     # {"status":"UP"}
curl -sf "https://$PROJECT_ID.web.app/api/schools" | head -c 200

# La cadena de medios completa: la canónica devuelve 302 hacia una firmada.
curl -sI "https://$PROJECT_ID.web.app/media/tools/<uuid>-<archivo>.pdf" | grep -i "^location"
# Debe empezar con https://storage.googleapis.com/... y traer X-Goog-Signature.
# Si responde 503: faltan credenciales, o roles/iam.serviceAccountTokenCreator (§4).
# Si responde 404 sobre un archivo que SÍ existe en el bucket: GCS_BUCKET apunta
# a otro bucket, o la service account no tiene lectura sobre él. Sin credenciales
# el cliente devuelve "no está" en vez de "no puedo", así que un 404 aquí no
# significa necesariamente que falte el objeto.

# Y que el bucket NO sea de lectura pública:
curl -sI "https://storage.googleapis.com/$GCS_BUCKET/tools/<uuid>-<archivo>.pdf" | head -1
# Debe decir 403. Si dice 200, hay un binding de allUsers que hay que quitar.
```

Después: entrar a la web, hacer login con una cuenta real y subir un archivo desde el CMS.

---

## 7. Migrar los datos que ya existen

Render/Supabase tiene datos reales. El orden importa.

```bash
# 1. Volcado de la base de staging. --no-owner y --no-acl porque los roles de
#    Supabase no existen en Cloud SQL.
pg_dump "$SUPABASE_SESSION_POOLER_URL" \
  --no-owner --no-acl --format=custom --file=explorarte.dump

# 2. Restaurar en Cloud SQL. Lo más simple es por proxy local:
./cloud-sql-proxy "$PROJECT_ID:$REGION:$INSTANCE" &
pg_restore --no-owner --no-acl --dbname="postgresql://postgres:<pass>@127.0.0.1:5432/explorarte" \
  explorarte.dump
```

> Flyway ya habrá corrido V1→V7 en el primer arranque del API. Restaurar encima de un esquema ya
> migrado da conflictos. **Restaura ANTES del primer despliegue**, o restaura sobre una base vacía
> y deja que Flyway vea `flyway_schema_history` ya presente en el volcado (que es lo que pasa si
> volcaste la base de staging completa, porque esa tabla viene incluida).

```bash
# 3. Copiar los archivos. Idempotente; no borra nada de Supabase.
export SUPABASE_URL=https://<ref>.supabase.co
export SUPABASE_KEY=<service_role key>
DRY_RUN=1 ./scripts/migrate-storage-to-gcs.sh   # primero mirar
./scripts/migrate-storage-to-gcs.sh             # después copiar

# 4. EL CORTE: reescribir las URLs guardadas.
psql "$CLOUD_SQL_URL" \
  -v old_prefix="https://<ref>.supabase.co/storage/v1/object/public/explorarte-media/" \
  -v new_prefix="https://$PROJECT_ID.web.app/media/" \
  -f scripts/migrate-media-urls.sql
```

### ⚠️ Antes del paso 4: qué le pasa a lo que ya está descargado

**Cambian todas las URLs de medios.** El efecto en las cachés existentes no es el mismo en los dos
clientes, y la diferencia está en por qué clave guarda cada uno:

| Cliente | Clave de la caché | Qué pasa |
|---|---|---|
| **Mobile (Expo)** | el **id** del `MediaItem`, con `sizeBytes` como versión (`src/lib/offlineStorage.ts:67-73`, `src/lib/media-sync.ts:16-25`) | **Nada.** Ni el id ni el tamaño cambian con la migración, así que `needsUpdate()` sigue devolviendo `false` y `getLocalUri()` sigue resolviendo al archivo local. Los teléfonos que ya bajaron contenido no vuelven a bajar nada. |
| **PWA (índice de medios en IndexedDB, PR #29)** | la **URL** | **Se invalida todo una vez.** Cada archivo ya cacheado se vuelve a descargar la próxima vez que ese navegador tenga red. Es inevitable: el archivo cambia de dominio. |

O sea que el susto es real pero acotado: le pasa a la PWA, no a la app instalada. Aun así, para una
docente con varios videos guardados en el navegador puede ser bastante tráfico de golpe, y con
datos móviles lo va a notar. Hazlo en horario de poco uso y avísalo antes.

> Si alguien quiere evitar incluso esa invalidación, la palanca es la caché de la PWA, no la
> migración: reindexar por id de `MediaItem` en vez de por URL la haría inmune a este cambio y a
> cualquier futuro cambio de dominio, igual que ya lo es la de mobile. Es una decisión del lote que
> mantiene esa caché.

El script corre en una transacción y verifica al final que no quede ninguna fila apuntando a
`supabase.co`; si queda alguna, aborta sin confirmar nada.

Mientras haya algo en tránsito, `APP_MEDIA_LEGACY_HOSTS=<ref>.supabase.co` hace que la API siga
aceptando URLs viejas en los adjuntos que un cliente reenvíe. Vacíala cuando el paso 4 haya
terminado.

---

## 8. Arranque en frío: los números (GCP-05)

### Lo medido

| Qué | Medición | Origen |
|---|---|---|
| Render, plan gratuito, primer request tras 15 min de inactividad | **más de 90 segundos** (timeout del test) | Medido en la auditoría (SCALE-06). `render.yaml` documentaba "~30-60s" — ya está corregido ahí. |
| Tamaño del jar antes de este batch | 61,699,142 B (58.8 MB) | `mvn package` local |
| Tamaño del jar después | 90,161,222 B (86.0 MB) | `mvn package` local |
| **Arranque del contenedor `prod` contra un Postgres limpio** | **6.9 s** (`Started ApiApplication in 6.945 seconds`) | `docker run` local, 1 contenedor, incluye Flyway V1→V7 |

Las librerías de Google Cloud suman 28.5 MB al jar. Serían 49 MB si no se excluyera el transporte
gRPC de `google-cloud-storage` (`api/pom.xml`), que no se usa porque el cliente va por JSON/HTTP:
medido, 111 MB con él y 90 MB sin él.

Esos 6.9 s son el dato más útil que hay sin desplegar: es el arranque real de este jar, con este
esquema, en un contenedor. En Cloud Run hay que sumarle el arranque del sandbox y el pull de la
imagen la primera vez, y restarle o sumarle según la CPU asignada.

### Lo estimado, y por qué es una estimación

**No hay ningún número de Cloud Run medido aquí, porque no se desplegó nada.** Lo que sigue son
estimaciones a partir del perfil conocido de la app (Spring Boot 3.3 + JPA + Flyway + Security,
jar de 85 MB) y hay que confirmarlas con `gcloud run services describe` y las trazas del primer
despliegue real:

| Escenario | Estimación de la primera respuesta | Nota |
|---|---|---|
| Cloud Run, `min-instances=0`, sin `--cpu-boost` | ~10–20 s | Los 6.9 s medidos más el sandbox y menos CPU durante el arranque. |
| Cloud Run, `min-instances=0`, con `--cpu-boost` | ~7–12 s | El flag ya está en el comando de §6.1. |
| Cloud Run, `min-instances=1` | **~0 s** | Nunca hay arranque en frío para el primer usuario. |
| Render gratuito (hoy) | **>90 s medido** | El punto de comparación. |

Es decir: incluso el peor caso de Cloud Run es entre **4 y 9 veces mejor** que lo que hay hoy. Pero
`min-instances=0` **sí** parte de cero, así que el problema se reduce mucho y no desaparece.

> Conviene volver a medir esta tabla con `gcloud run services describe` y las trazas del primer
> despliegue, y reemplazar las estimaciones por números reales. Una estimación que se queda en un
> documento tres años acaba citándose como si fuera una medición.

### El compromiso, con el costo

Precios de lista de `us-central1` al escribir esto; **verificar en el
[calculador](https://cloud.google.com/products/calculator)** porque cambian.

`min-instances=1`, 1 vCPU / 512 MiB, un mes = 730 h = 2,628,000 s:

```
CPU en reposo:     2,628,000 vCPU-s × $0.0000025/vCPU-s  =  $6.57
Memoria en reposo: 1,314,000 GiB-s  × $0.00000025/GiB-s  =  $0.33
                                                    total ≈ $7 / mes
```

Contra eso hay que poner el resto de la factura, que existe igual:

| Concepto | Estimación mensual |
|---|---|
| Cloud SQL `db-f1-micro` + 10 GB SSD | **~$9–12** — no tiene capa gratuita, se paga aunque nadie use la app |
| Cloud Run con `min-instances=0` y tráfico bajo | **~$0** — cabe en la capa gratuita (2M requests, 180k vCPU-s, 360k GiB-s al mes) |
| Cloud Run con `min-instances=1` | **~$7** — el cálculo de arriba; la capa gratuita no cubre el tiempo en reposo |
| Firebase Hosting | **~$0** para este volumen |
| Cloud Storage (10 GB + 20 GB de egreso) | **~$2.60** ($0.020/GB almacenado + $0.12/GB de salida) |

**Recomendación: empezar con `min-instances=0`.** Un arranque en frío de 5–10 s con `--cpu-boost`
es aceptable —y es una mejora enorme sobre los 90 s de hoy— y ahorra el 40% de una factura que
ronda los $12–15 al mes. Pasar a `min-instances=1` es un solo comando el día que la espera moleste
de verdad, sin redeploy:

```bash
gcloud run services update "$SERVICE" --region "$REGION" --min-instances=1
```

### Mientras tanto, en Render

Render se queda en el plan gratuito y por tanto se queda con sus 90 s. Dos mitigaciones que no
cuestan dinero:

- Un ping cada 10 minutos a `/actuator/health` (cron-job.org o similar) evita el dormido. Ojo: el
  plan gratuito da 750 horas-instancia al mes y mantener un servicio despierto 24/7 consume 730, o
  sea casi todo el presupuesto para un solo servicio.
- Del lado del cliente, mostrar un estado explícito de "despertando el servidor" en vez de un
  spinner genérico cuando la espera pasa de unos segundos. Eso es de otro lote (SCALE-06 depende de
  PWA-1.2), pero es la mitad de la solución: 90 s con explicación se toleran, 90 s sin ella parecen
  una app rota.

---

## 8.bis Qué se verificó de verdad, y qué encontró (GCP-07)

"Está listo para migrar" no es una afirmación que se pueda hacer sin ejecutar nada. Esto es lo que
se ejecutó, en esta máquina, y lo que apareció.

**Ejecutado:**

| Verificación | Resultado |
|---|---|
| `./mvnw test` | **154 tests, 0 fallos** |
| Cadena Flyway V1→V7 sobre un PostgreSQL 16 limpio | Aplica limpia; `validate()` pasa; la segunda pasada no ejecuta nada (`MigrationChainTest`) |
| `scripts/migrate-media-urls.sql` contra el esquema real | Reescribe las siete columnas y no deja nada apuntando a `supabase.co` (`MigrationChainTest`) |
| `docker build --target prod` | Construye, con la suite completa corriendo dentro |
| Contenedor `prod` con variables con forma de Cloud Run, contra un Postgres vacío | Arranca en **6.9 s**, escucha en el `PORT` inyectado (8080), aplica V1→V7, `/actuator/health` → `{"status":"UP"}` |
| Sin `JWT_SECRET` | **No arranca**, con el mensaje correcto. Es la razón de la advertencia en §4. |
| Autorización tras el cambio de medios | `/schools` 200 · `/posts` 401 · `POST /media/upload` 401 · `GET /media/**` **no** 401 |

**No ejecutado, y por qué:** nada contra Google Cloud. No se creó ningún proyecto, bucket,
instancia ni secreto, no se firmó ninguna URL real y no se movió ningún dato. La firma V4 y el
camino de IAM `signBlob` **no están probados contra el servicio real** — solo el comportamiento
degradado sin credenciales. La comprobación de §6.3 es la que cierra ese hueco el día del
despliegue.

**Tres arranques rotos que ya estaban en `main` y que ningún test veía.** La suite era 100 %
unitaria, así que nada levantaba el contexto de Spring: 147 tests en verde y un contenedor que no
arrancaba en ningún entorno.

1. **`SecurityConfig`**: anclaba el filtro de rate limiting contra `JwtAuthenticationFilter` antes
   de agregarlo. Spring Security 6.3 → `does not have a registered order`, el contexto no levanta.
2. **`ApiExceptionHandler`**: declaraba un `@ExceptionHandler(MaxUploadSizeExceededException)`
   propio además del que ya trae `ResponseEntityExceptionHandler` →
   `Ambiguous @ExceptionHandler method mapped`, el contexto no levanta.
3. **`DataSeeder`**: sembraba posts y eventos con clave foránea a los usuarios de ejemplo, aunque
   la siembra de usuarios se hubiera saltado. Y saltarse esa siembra es justo lo que pasa en
   producción, donde `SEED_USER_PASSWORD` se deja sin setear a propósito (SEC-02) — o sea que
   fallaba **solo** contra una base vacía sin cuentas demo, que es exactamente el primer arranque
   contra Cloud SQL.

Los tres están arreglados en este PR, y `ApplicationStartsTest` levanta ahora el contexto completo
contra un Postgres real, así que los tres vuelven a aparecer como test rojo y no como despliegue
fallido. El primero y el segundo rompían cualquier despliegue, incluido el de Render que está vivo
hoy; el tercero rompía específicamente el primer despliegue en Cloud SQL.

---

## 9. Render después de la migración

Render sigue vivo como dev/staging y `render.yaml` se mantiene al día. Lo único que cambia con este
batch es el almacenamiento: Render ya no sube a Supabase Storage.

Render **no** corre dentro de Google Cloud, así que ADC no tiene un metadata server del que sacar
credenciales. Hay que darle una key de service account explícita:

```bash
gcloud iam service-accounts create explorarte-render --display-name="Render staging"
gcloud storage buckets add-iam-policy-binding "gs://$GCS_BUCKET_STAGING" \
  --member="serviceAccount:explorarte-render@$PROJECT_ID.iam.gserviceaccount.com" \
  --role=roles/storage.objectAdmin
gcloud iam service-accounts keys create render-sa.json \
  --iam-account="explorarte-render@$PROJECT_ID.iam.gserviceaccount.com"
```

El JSON se pega en la variable `GOOGLE_APPLICATION_CREDENTIALS_JSON` del dashboard de Render (ya
declarada como `sync: false` en `render.yaml`) y se escribe a un archivo al arrancar, apuntando
`GOOGLE_APPLICATION_CREDENTIALS` a él.

> Esa key **sí** es material sensible, y es la única que sigue existiendo después de GCP-04. Existe
> solo porque este entorno está fuera de Google Cloud. Dale únicamente `storage.objectAdmin` sobre
> un bucket de staging, y rótala si alguien deja el equipo.

Conviene un bucket aparte para staging: compartir el de producción significa que un admin probando
en staging sube al mismo bucket que ven las docentes reales.

---

## 10. Mobile: no se despliega, se publica

```bash
npm install -g eas-cli
eas login
eas build --platform android
eas submit --platform android
```

Antes, apuntar `EXPO_PUBLIC_API_URL` a la URL real de producción (ver [`COMO-EMPEZAR.md`](./COMO-EMPEZAR.md)),
no a `localhost` ni a una IP local.

---

## 11. Checklist de variables de entorno de producción

Actualizada a lo que el código lee hoy. Ninguna debe ser igual a los valores de `.env.example`.

**Secretos (Secret Manager, `--set-secrets`):**

- [ ] `JWT_SECRET` — **créalo antes del primer deploy o el deploy falla.** `openssl rand -base64 48`.
- [ ] `SPRING_DATASOURCE_PASSWORD` — contraseña real de Cloud SQL, no `explorarte_dev_password`.
- [ ] `RESEND_API_KEY` — solo si se va a enviar correo de recuperación de contraseña.

**Configuración (`--set-env-vars`):**

- [ ] `SPRING_DATASOURCE_URL` — la forma con `cloudSqlInstance` + `socketFactory` (§1).
- [ ] `SPRING_DATASOURCE_USERNAME`
- [ ] `GCS_BUCKET` — el bucket privado de Cloud Storage for Firebase.
- [ ] `APP_MEDIA_PUBLIC_BASE_URL` — el dominio de **Hosting**, no la URL de Cloud Run (§5).
- [ ] `APP_CORS_ALLOWED_ORIGINS` — el dominio real, sin `localhost`.
- [ ] `JWT_EXPIRATION_MINUTES` — 1440 salvo que se decida otra cosa.
- [ ] `VITE_API_URL` — solo si **no** se usa el rewrite de Hosting; entonces también tiene que estar en `APP_CORS_ALLOWED_ORIGINS`.
- [ ] `EXPO_PUBLIC_API_URL` — antes de `eas build`.

**Que NO se setean, a propósito:**

- [ ] `SEED_USER_PASSWORD` — sin ella no se crean cuentas de ejemplo (SEC-02).
- [ ] `DATABASE_URL` — tiene precedencia sobre `SPRING_DATASOURCE_URL` y mandaría producción a otra base (§1).
- [ ] `SUPABASE_URL` / `SUPABASE_KEY` — **ya no existen** en el código (GCP-04).
- [ ] `APP_MEDIA_LEGACY_HOSTS` — solo durante la ventana de migración (§7), y se vacía después.

**Valores por defecto que conviene revisar y no tocar sin motivo:** `AUTH_RATE_LIMIT_*`,
`AUTH_OTP_MAX_ATTEMPTS`, `AUTH_USER_CACHE_SECONDS`, `GCS_SIGNED_URL_TTL_SECONDS`,
`APP_MEDIA_REDIRECT_CACHE_SECONDS`. Están documentados en `.env.example` y en `application.yml`.

---

## 12. Qué falta y qué es el siguiente paso

- **CI/CD.** Un workflow que en cada push a `main` construya, corra los tests y despliegue con los
  comandos de §6. Vale la pena esperar a tener el primer despliegue manual funcionando.
- **`APP_MEDIA_REQUIRE_AUTH_FOR_PRIVATE=true`**, junto con el cambio de cliente que deja de meter
  la URL de medios directo en `src` (§5).
- **Backups de Cloud SQL**: `gcloud sql instances patch "$INSTANCE" --backup-start-time=07:00`.
  No está en este runbook porque no es parte de la portabilidad, pero es lo primero que hay que
  hacer después del primer despliegue real.
