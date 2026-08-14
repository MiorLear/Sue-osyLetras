# ExplorArte API

API REST en **Java (Spring Boot 3 + PostgreSQL)** que implementa el contrato en
[`../shared/openapi.yaml`](../shared/openapi.yaml). No necesitas tener Java, Maven ni Postgres
instalados en tu máquina — todo corre dentro de Docker.

## No sé Java, ¿qué corro?

Desde la raíz del repo:

```bash
docker compose up --build
```

Eso es todo. Docker descarga todo lo necesario, levanta Postgres, compila y arranca la API, y
la deja escuchando en `http://localhost:8000` con datos de ejemplo ya cargados.

- **Explorar la API sin leer Java:** abre `http://localhost:8000/swagger-ui.html` — ahí puedes
  ver cada endpoint y probarlo directamente ("Try it out"), incluyendo login para obtener un
  token y pegarlo en el botón "Authorize" de arriba.
- **Verificar que está viva:** `http://localhost:8000/actuator/health` debe responder
  `{"status":"UP"}`.
- **Editar código:** cambia cualquier archivo en `api/src/`, guarda, y la API se reinicia sola
  en unos segundos (Spring Boot DevTools + hot reload). Solo necesitas `--build` de nuevo si
  cambiaste `pom.xml` (una dependencia nueva).
- **Resetear la base de datos** (vuelve a poblarse desde cero con los datos de ejemplo):
  ```bash
  docker compose down -v && docker compose up --build
  ```
- **Ver qué está pasando:**
  ```bash
  docker compose logs -f api
  ```

> En Windows, los cambios guardados dentro del contenedor (bind mount) pueden tardar un par de
> segundos más en detectarse que en Mac/Linux — no es que esté roto, solo un poco más lento.

## Cuentas de ejemplo (seed)

La API precarga estos usuarios al arrancar por primera vez (misma contraseña para todos,
configurable vía `SEED_USER_PASSWORD` en el `.env` de la raíz — por defecto `explorarte123`):

| Email | Rol |
|---|---|
| `admin@explorarte.org` | admin |
| `maria@ejemplo.com` | docente |
| `ana@ejemplo.com` | docente |
| `lucia@ejemplo.com` | docente |
| `sofia@ejemplo.com` | docente |

## Qué hay adentro (para quien sí quiera tocar Java)

- **Maven** con **Maven Wrapper** (`./mvnw`) — nadie necesita Maven instalado; el wrapper baja
  la versión exacta que el proyecto espera.
- **Spring Boot 3 / Java 21**, sin Lombok (menos "magia" de anotaciones para quien es nuevo en Java).
- **Flyway** (`src/main/resources/db/migration/`) crea el esquema de la base de datos.
- **`DataSeeder`** (`src/main/java/com/explorarte/api/seed/DataSeeder.java`) precarga los mismos
  datos que `../shared/src/api/mock/seed.ts`, para que la API real se comporte igual que el mock
  que ya usa el frontend.
- **JWT** simple (`Authorization: Bearer <token>`) para autenticación — sin OAuth2 ni sesiones.
- Un paquete por recurso del contrato: `auth/`, `user/`, `emotions/`, `community/`, `calendar/`,
  `learning/`, `tools/`, `misc/`.

### Correr fuera de Docker (opcional, si sí tienes Java 21 + Postgres locales)

```bash
./mvnw spring-boot:run
```

Necesitas Postgres corriendo y las variables de `SPRING_DATASOURCE_*` apuntando a él (ver
`src/main/resources/application.yml` para los nombres exactos y sus valores por defecto).
