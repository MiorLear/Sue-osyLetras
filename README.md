# ExplorArte — Sueños y Letras 📚

**PWA para docentes**, en producción en **[explorarte.app](https://explorarte.app)**. ExplorArte es
una metodología de Sueños y Letras para fortalecer la salud mental y el bienestar emocional en
comunidades educativas a través de la lectura, el arte y experiencias participativas. La app le da a
cada docente la biblioteca de emociones, la caja de herramientas, el material de aprendizaje y la
comunidad — y todo lo que haya descargado le funciona sin conexión.

> 🆕 **¿Primera vez, en una computadora nueva?** Sigue [`COMO-EMPEZAR.md`](./COMO-EMPEZAR.md) — paso
> a paso desde cero, sin dar por hecho que conoces Docker ni Java.
>
> 🧭 **¿Ya lo tienes corriendo?** [`COMO-TRABAJAMOS.md`](./COMO-TRABAJAMOS.md) (arquitectura,
> convenciones, cómo agregar una funcionalidad). Para desplegar,
> [`DESPLIEGUE.md`](./DESPLIEGUE.md), que es el runbook único. Para el acceso sin internet a
> documentos y videos, [`OFFLINE.md`](./OFFLINE.md).

## Qué hay en el repo

| Carpeta | Qué es |
|---|---|
| [`web/`](./web) | **La PWA.** React 19 + Vite + `vite-plugin-pwa`. Es lo que usan las docentes y lo que se despliega. |
| [`api/`](./api) | La API REST en Java (Spring Boot) + Flyway. Corre en Cloud Run contra Cloud SQL. |
| [`shared/`](./shared) | Tipos y cliente de API compartidos, más el cliente mock con datos de ejemplo. |
| [`infra/`](./infra) | Configuración de infraestructura versionada (CORS del bucket de medios). |
| [`scripts/`](./scripts) | Utilidades de mantenimiento y migraciones puntuales de datos. |
| [`src/`](./src) | La app Expo/React Native original. **Ya no es lo que se publica**; el producto es la PWA. |

## Cómo levantar el proyecto

```bash
cp .env.example .env      # solo la primera vez — los valores por defecto ya funcionan
docker compose up --build
```

Y listo: http://localhost:5173.

## Backend + web (Docker) — no necesitas instalar Java

La API está hecha en **Java (Spring Boot)** y vive en [`api/`](./api). No necesitas tener Java, Maven
ni PostgreSQL instalados — todo corre dentro de Docker.

Esto levanta tres servicios:

| Servicio | URL | Qué es |
|---|---|---|
| `web` | http://localhost:5173 | La PWA (Vite), ya conectada a la API real |
| `api` | http://localhost:8000 | La API Java, con datos de ejemplo precargados |
| `api` (docs) | http://localhost:8000/swagger-ui.html | Explora y prueba cada endpoint sin leer una línea de Java |
| `db` | localhost:5432 | PostgreSQL, solo si necesitas conectarte con un cliente SQL |

Cuentas de ejemplo precargadas por la API:

- `admin@explorarte.org` — administrador
- `maria@ejemplo.com`, `ana@ejemplo.com`, `lucia@ejemplo.com`, `sofia@ejemplo.com` — docentes

La contraseña de todas es la que pongas en `SEED_USER_PASSWORD` dentro de tu `.env`. **No se publica
aquí**: este repositorio es público y una contraseña escrita en el README acaba sirviendo en algún
entorno desplegado donde alguien la copió tal cual (SEC-02). Si dejas la variable vacía, la API no
crea ninguna cuenta de ejemplo — y por eso **producción no tiene ningún ADMIN de contraseña
conocida**: ese rol se concede a una cuenta existente con
[`scripts/promote-admin.sql`](./scripts/promote-admin.sql).

Para apuntar a otra base de datos —una remota, la de alguien más— pon `SPRING_DATASOURCE_URL`,
`SPRING_DATASOURCE_USERNAME` y `SPRING_DATASOURCE_PASSWORD` en tu `.env`.

Comandos útiles (equivalentes a `docker compose ...`, agregados a `package.json`):

```bash
npm run dev:stack             # docker compose up --build
npm run dev:stack:down        # apaga los contenedores
npm run dev:stack:reset-db    # borra la base de datos y la vuelve a poblar desde cero
npm run dev:stack:logs        # sigue los logs de todos los servicios
```

Ver [`api/README.md`](./api/README.md) para más detalle (hot reload, cómo resetear la BD, etc.).

### Trabajar solo en la PWA

```bash
npm --prefix web run dev      # Vite en http://localhost:5173
npm --prefix web run test     # vitest
npm --prefix web run e2e      # Playwright contra el mock determinista
```

Sin `VITE_API_URL`, la PWA exige `VITE_API_MOCK=true` para arrancar contra el mock. Es explícito a
propósito: una URL ausente nunca debe convertir una comprobación de contraseña en el demo sin
credenciales. También existe `VITE_API_MOCK_MODULES`, una lista separada por comas
(`auth,emotions,posts,events,learning,tools,profile,misc,admin`) que se queda en el mock aunque la
URL esté configurada — útil para avanzar en una pantalla cuya parte de la API todavía no está.

## Despliegue

**Automático al mergear a `main`.** CI corre las pruebas y, si quedan en verde, dispara los dos
despliegues sobre ese mismo commit:

| Workflow | Qué publica |
|---|---|
| `Deploy Firebase Hosting` | La PWA → Firebase Hosting |
| `Deploy Cloud Run` | La API → Cloud Run, aplicando las migraciones de Flyway al arrancar |

Los dos esperan a CI con `workflow_run` en vez de dispararse con el push: desplegar en paralelo con
los tests publica justo lo que acaba de romperse. Y los dos son la misma mitad de una sola cosa —
publicar solo una ya dejó a la PWA hablando con un API sin la migración que necesitaba.

El runbook completo, incluidos los despliegues a mano y el primer arranque, está en
[`DESPLIEGUE.md`](./DESPLIEGUE.md).

## Notas

- El contenido pedagógico —emociones, actividades, herramientas, videos de introducción— lo cargan
  las administradoras desde el CMS en `/admin`, no está en el código.
- Los cuatro videos de introducción viajan dentro de la app (`web/public/videos/`) como respaldo
  para cuando el CMS todavía no tiene uno. No entran en el precache: son 22 MB y nadie debe bajarlos
  antes de poder abrir la app.
- Los medios (fotos, PDFs, videos) viven en Cloud Storage y se sirven por `/media/**` en el propio
  dominio. Que sean del mismo origen no es un detalle estético: desde otro origen, el redirect a la
  URL firmada pierde la cabecera `Origin` y el navegador bloquea toda descarga.
