# Plan de despliegue: Firebase (Hosting + Cloud Run + Cloud SQL)

Este documento describe **cómo se va a hospedar el proyecto en producción**. Todavía no está
desplegado — esto es el plan de destino, para que cualquiera que trabaje en el proyecto sepa
hacia dónde vamos y qué decisiones de diseño ya están tomadas pensando en esto.

> **Esto no es lo mismo que la API de Render.** `render.yaml` ya despliega la API + Postgres en
> Render como un **backend compartido de equipo para desarrollo** (para que mobile no dependa de
> túneles ni de que la laptop de alguien esté prendida — ver `COMO-EMPEZAR.md`). Render es
> práctico para desarrollo diario, pero el plan real de producción sigue siendo Firebase/Cloud
> Run/Cloud SQL, descrito abajo — con dominio propio, sin cold-starts del plan gratuito, y sin
> el límite de 30 días de la base de datos gratuita de Render.

## Resumen: qué va dónde

"Hospedar todo en Firebase" en la práctica significa tres piezas de Google Cloud que se
manejan juntas desde la misma consola/CLI de Firebase:

| Pieza | Servicio | Por qué |
|---|---|---|
| **Web** (`web/`) | **Firebase Hosting** | Es un sitio estático (Vite build) — el caso de uso clásico de Firebase Hosting. |
| **API** (`api/`) | **Cloud Run** | Firebase Hosting no ejecuta código de servidor arbitrario (Java/Spring Boot). Cloud Run sí — corre el mismo contenedor Docker que ya usamos en `api/Dockerfile` (el target `prod`), y Firebase Hosting puede enrutar tráfico hacia él (`firebase.json` ya tiene esto configurado). |
| **Base de datos** | **Cloud SQL for PostgreSQL** | Firebase no tiene una base de datos relacional (Firestore es NoSQL, y reescribir todo el esquema/JPA a NoSQL sería un cambio enorme, no un ajuste). Cloud SQL es Postgres real, administrado, y vive en el mismo proyecto de Google Cloud que Firebase. |
| **Mobile** (`src/`) | *No se "hospeda"* | Una app Expo/React Native no vive en un servidor — se publica en App Store / Play Store (con **EAS Build/Submit**, la herramienta de Expo para esto). Firebase sí puede sumar valor aquí más adelante (Auth, Analytics, Crashlytics, Push, o distribución beta con Firebase App Distribution), pero eso es aparte de "hosting". |
| **Documentos/videos descargables** | **Cloud Storage for Firebase** | Cloud Run es efímero — no es lugar para guardar archivos binarios. Cloud Storage es donde deberían vivir los PDFs/videos reales que mobile descarga para verlos offline. Ver [`OFFLINE.md`](./OFFLINE.md) para el detalle de ese lado. |

Es decir: **"Firebase" aquí es el punto de entrada/consola, pero el músculo real es Cloud Run +
Cloud SQL** (que están en la misma cuenta de Google Cloud). Esto ya está anticipado en el código:

- `api/Dockerfile` tiene un target `prod` que compila un jar y lo corre en una imagen liviana —
  listo para subir a Cloud Run tal cual.
- `api/src/main/resources/application.yml` usa `server.port: ${PORT:8000}` — Cloud Run inyecta
  su propia variable `PORT` y esto ya la respeta (en local/Docker Compose sigue usando 8000 por
  defecto porque `PORT` no está seteada ahí).
- Todos los secretos/config del backend (`JWT_SECRET`, credenciales de base de datos, orígenes
  de CORS) ya se leen de variables de entorno (`api/src/main/resources/application.yml`) — no
  hay nada hardcodeado que haya que tocar para producción, solo hay que **darle valores reales**
  a esas variables en Cloud Run.
- `web/firebase.json` ya está creado con la configuración de Hosting + el rewrite hacia Cloud
  Run (`/api/**` → el servicio de Cloud Run), para que la web y la API compartan el mismo
  dominio y no haya que lidiar con CORS entre dominios distintos en producción.

## Lo que falta (a propósito no lo hicimos todavía)

No creamos cuentas de Firebase/Google Cloud, proyectos reales, ni desplegamos nada — eso
requiere una cuenta de facturación real y decisiones (nombre del proyecto, región, presupuesto)
que le tocan al equipo, no a un ajuste de código. Cuando estén listos, esta guía es el paso a
paso.

---

## Paso a paso para desplegar (cuando el equipo esté listo)

### 0. Requisitos

- Una cuenta de Google con **Firebase CLI** instalado: `npm install -g firebase-tools`
- Facturación habilitada en el proyecto de Google Cloud (Cloud Run y Cloud SQL no están en el
  plan gratuito de Firebase "Spark" — se necesita el plan "Blaze", que sigue teniendo una capa
  gratuita generosa, pero requiere una tarjeta asociada).
- `gcloud` CLI instalado (para Cloud Run/Cloud SQL) — [cloud.google.com/sdk](https://cloud.google.com/sdk)

### 1. Crear el proyecto de Firebase

```bash
firebase login
firebase projects:create explorarte-prod   # o el nombre que decida el equipo
```

Esto crea un proyecto de Firebase que **es** un proyecto de Google Cloud por debajo — todo lo
que hagamos con `gcloud` en los pasos siguientes usa el mismo proyecto.

### 2. Base de datos: Cloud SQL (PostgreSQL)

```bash
gcloud sql instances create explorarte-db \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region=us-central1

gcloud sql databases create explorarte --instance=explorarte-db
gcloud sql users set-password postgres --instance=explorarte-db --password=<contraseña-real-segura>
```

> `db-f1-micro` es el tier más pequeño/barato — suficiente para empezar. Se puede escalar
> después sin cambiar nada del código.

### 3. Backend: construir y subir la imagen, desplegar a Cloud Run

```bash
cd api
gcloud builds submit --tag us-central1-docker.pkg.dev/<PROJECT_ID>/explorarte/api

gcloud run deploy explorarte-api \
  --image us-central1-docker.pkg.dev/<PROJECT_ID>/explorarte/api \
  --region us-central1 \
  --platform managed \
  --add-cloudsql-instances <PROJECT_ID>:us-central1:explorarte-db \
  --set-env-vars SPRING_DATASOURCE_URL="jdbc:postgresql:///explorarte?cloudSqlInstance=<PROJECT_ID>:us-central1:explorarte-db&socketFactory=com.google.cloud.sql.postgres.SocketFactory" \
  --set-env-vars SPRING_DATASOURCE_USERNAME=postgres \
  --set-env-vars SPRING_DATASOURCE_PASSWORD=<contraseña-real-segura> \
  --set-env-vars JWT_SECRET=<un-secreto-largo-y-random-generado-para-produccion> \
  --set-env-vars JWT_EXPIRATION_MINUTES=1440 \
  --set-env-vars SEED_USER_PASSWORD=<contraseña-real-para-las-cuentas-demo-o-quitar-el-seeder-en-prod> \
  --set-env-vars APP_CORS_ALLOWED_ORIGINS=https://explorarte-prod.web.app \
  --no-allow-unauthenticated=false
```

> **Nota:** conectar Cloud Run a Cloud SQL usa el conector de socket de Google (`socketFactory`
> arriba), que requiere el driver `com.google.cloud.sql:postgres-socket-factory` — **todavía no
> está en `api/pom.xml`**, hay que agregarlo cuando se haga este despliegue por primera vez.
> Como alternativa más simple para un primer despliegue, se puede usar la IP pública de Cloud SQL
> directamente en `SPRING_DATASOURCE_URL` (menos seguro, pero no requiere esa dependencia extra).

> **Nota sobre el seeder:** `DataSeeder` (`api/src/main/java/com/explorarte/api/seed/DataSeeder.java`)
> siempre corre al arrancar y crea las cuentas de ejemplo si las tablas están vacías. Para un
> ambiente de producción real, hay que decidir si eso se queda (útil para una demo pública) o se
> desactiva (para no tener cuentas de prueba con contraseña conocida en producción).

### 4. Web: Firebase Hosting

```bash
cd web
npm run build          # genera web/dist
firebase init hosting  # solo la primera vez — usa la config que ya está en web/firebase.json
firebase deploy --only hosting
```

Esto publica `web/dist` en algo como `https://explorarte-prod.web.app`. El rewrite
`/api/**` → Cloud Run ya está en `web/firebase.json`, así que las llamadas del frontend a
`/api/...` llegan al backend sin problemas de CORS (mismo dominio). Si prefieren llamar al
backend por su URL directa de Cloud Run en vez del rewrite, hay que setear
`VITE_API_URL=https://explorarte-api-xxxxx.run.app` al momento de build y asegurarse de que esa
URL esté en `APP_CORS_ALLOWED_ORIGINS` del backend.

### 5. Verificar

- `https://explorarte-prod.web.app` carga la web.
- `https://explorarte-prod.web.app/api/schools` responde JSON (confirma que el rewrite a Cloud
  Run funciona).
- Hacer login con una cuenta real (o la de ejemplo, si el seeder sigue activo) para confirmar
  que la web habla con el backend en producción.

---

## Mobile: no se despliega, se publica

La app en `src/` (Expo) no tiene un paso equivalente a "hosting". El camino normal es:

```bash
npm install -g eas-cli
eas login
eas build --platform android   # o ios
eas submit --platform android  # sube el build a Play Store / App Store Connect
```

Antes de esto, hay que apuntar `EXPO_PUBLIC_API_URL` (ver [`COMO-EMPEZAR.md`](./COMO-EMPEZAR.md))
a la URL real de producción (Cloud Run o el dominio de Firebase Hosting), no a `localhost` ni a
una IP local.

Si en algún momento quieren una demo web de la versión mobile (como ya existe hoy en Render vía
`render.yaml`), Firebase Hosting soporta múltiples "sites" en un mismo proyecto — se podría
agregar un segundo site que sirva `npx expo export -p web`.

---

## Variables de entorno de producción — checklist

Ninguna de estas debe ser igual a los valores de desarrollo en `.env.example`:

- [ ] `JWT_SECRET` — generar uno nuevo, largo y aleatorio (ej. `openssl rand -base64 48`)
- [ ] `SPRING_DATASOURCE_PASSWORD` — contraseña real de Cloud SQL, no `explorarte_dev_password`
- [ ] `SEED_USER_PASSWORD` — decidir si el seeder sigue activo en producción, y si sí, con qué contraseña
- [ ] `APP_CORS_ALLOWED_ORIGINS` — el dominio real de Firebase Hosting (no `localhost`)
- [ ] `VITE_API_URL` (si no se usa el rewrite de Hosting) — la URL real de Cloud Run
- [ ] `EXPO_PUBLIC_API_URL` (mobile) — la URL real, antes de correr `eas build`

## Costos a tener en cuenta

Cloud Run cobra por uso (bastante barato para tráfico bajo/medio, tiene capa gratuita mensual).
Cloud SQL **no** tiene capa gratuita — la instancia más chica (`db-f1-micro`) cuesta un monto
fijo mensual aunque no se use. Firebase Hosting tiene una capa gratuita generosa para tráfico
estático. Vale la pena revisar el [pricing calculator de Google Cloud](https://cloud.google.com/products/calculator)
antes de desplegar, para no tener sorpresas.

## Posible siguiente paso: CI/CD

No está implementado todavía, pero el camino natural sería un GitHub Actions workflow que en
cada push a `main`: compile el backend, corra `npm run build` en `web/`, y despliegue ambos con
los comandos de arriba automáticamente. Vale la pena esperar a tener el primer despliegue manual
funcionando antes de automatizarlo.
