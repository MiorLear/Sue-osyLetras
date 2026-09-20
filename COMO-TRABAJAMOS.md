# Cómo trabajamos en este proyecto

Esta guía es para cualquiera que se une al equipo y ya tiene el entorno corriendo (si no, ver
[`COMO-EMPEZAR.md`](./COMO-EMPEZAR.md) primero). Explica cómo está organizado el código, cómo
agregar una funcionalidad sin romper nada, y hacia dónde va el proyecto.

---

## 1. Mapa del repositorio

```
SueñosyLetras/
  web/              → LA PWA. Es el producto: React 19 + Vite, en explorarte.app.
  api/              → Backend en Java (Spring Boot + PostgreSQL). Corre en Docker.
  shared/           → El contrato de datos + cliente API. Lo usan la PWA y src/.
  infra/            → Configuración de infraestructura versionada.
  src/              → App Expo original. Ya no se publica.
  docker-compose.yml, .env.example  → Levantan db + api + web con un comando.
```

| Si necesitas... | Empieza aquí |
|---|---|
| Levantar el proyecto por primera vez | [`COMO-EMPEZAR.md`](./COMO-EMPEZAR.md) |
| Entender el backend en Java (sin saber Java) | [`api/README.md`](./api/README.md) |
| Desplegar a producción (Firebase/Cloud Run) | [`DESPLIEGUE.md`](./DESPLIEGUE.md) |
| Acceso offline a documentos/videos descargados | [`OFFLINE.md`](./OFFLINE.md) |
| Ver qué endpoints existen y qué forma tienen | [`shared/openapi.yaml`](./shared/openapi.yaml) |
| Ver qué datos de ejemplo hay | [`shared/src/api/mock/seed.ts`](./shared/src/api/mock/seed.ts) |

---

## 2. La pieza central: `shared/`

Todo dato que se muestra en mobile o web pasa por el mismo contrato. Antes de tocar una
pantalla, vale la pena entender esta cadena:

```
shared/openapi.yaml            ← la fuente de verdad de "qué forma tiene cada endpoint"
        │
        ├─ shared/src/types/           (los tipos TypeScript que reflejan ese contrato)
        ├─ shared/src/api/client.ts    (la interfaz ApiClient — un método por endpoint)
        ├─ shared/src/api/mock/        (implementación en memoria, para desarrollar sin backend)
        └─ shared/src/api/http/        (implementación real, llama al backend Java)
```

Las pantallas de mobile y web **nunca llaman `fetch` directamente** — siempre a través de
`api.algo.metodo()` (ver `web/src/lib/api.ts` y `src/lib/api.ts`). Esto es lo que permite que
cada pantalla decida, por módulo, si usa datos de mentira o la API real (ver
`VITE_API_MOCK_MODULES` / `EXPO_PUBLIC_API_MOCK_MODULES` en el `README.md`) sin cambiar una
sola línea de la pantalla.

### Cómo agregar un endpoint nuevo (flujo completo)

Ejemplo: quieres agregar "marcar una publicación como favorita" (`/posts/:id/favorite`).

1. **Contrato**: agrega el endpoint y sus schemas a `shared/openapi.yaml`.
2. **Tipos**: si hace falta un tipo nuevo, agrégalo en `shared/src/types/`.
3. **Interfaz del cliente**: agrega el método a la interfaz correspondiente en
   `shared/src/api/client.ts` (ej. `PostsApi.favorite(id): Promise<Post>`).
4. **Mock**: implementa ese método en `shared/src/api/mock/index.ts` (mutando el estado en
   memoria) — así el equipo puede seguir trabajando aunque el backend no esté listo.
5. **HTTP**: implementa el mismo método en `shared/src/api/http/index.ts` (solo hace el
   `fetch` real al endpoint).
6. **Backend Java**: agrega el endpoint en el controller correspondiente
   (`api/src/main/java/com/explorarte/api/community/PostController.java` en este ejemplo),
   con su DTO si hace falta.
7. **Pantallas**: en mobile/web, llama `api.posts.favorite(id)` desde donde corresponda.

Este orden (contrato → mock → http → backend → pantalla) es intencional: te deja **probar la
pantalla contra el mock de inmediato**, sin esperar a que el backend Java esté terminado, y
cuando el backend sí esté listo, cambiar de mock a real no toca la pantalla para nada.

### Un backend, dos frontends, cero duplicación de reglas de negocio

`shared/` es la única fuente de verdad de las formas de los datos. Si algo se siente raro de
mantener en dos lugares (mobile y web), probablemente debería vivir en `shared/` en vez de
copiarse.

---

## 3. Backend en Java — qué mirar

No hace falta saber Java a fondo para tocar cosas pequeñas. La estructura es un paquete por
recurso, y todos siguen el mismo patrón:

```
api/src/main/java/com/explorarte/api/<recurso>/
  <Entidad>.java              → la tabla, básicamente
  <Recurso>Repository.java    → una interfaz vacía (Spring Data genera las queries solas)
  <Recurso>Controller.java    → los @GetMapping/@PostMapping — aquí está la lógica de cada endpoint
  <Recurso>Dto.java           → la forma exacta que ve el frontend (records, sin lógica)
```

Los datos de ejemplo viven en un solo lugar:
`api/src/main/java/com/explorarte/api/seed/DataSeeder.java` — mirror manual de
`shared/src/api/mock/seed.ts`. Si agregas datos al mock, considera agregarlos también aquí para
que el backend real se vea igual.

**Antes de hacer un PR que toque `api/`:**
```bash
cd api && ./mvnw -q compile        # o dentro de docker: docker compose exec api mvn -q compile
```

---

## 4. Convenciones de trabajo (propuesta inicial — ajustable por el equipo)

- **Rama `main`** siempre debe poder levantarse con `docker compose up --build` sin errores.
- Trabaja en una rama por feature/fix (`feature/nombre-corto`, `fix/nombre-corto`) y abre un PR
  hacia `main`. Al menos una persona revisa antes de mergear.
- Si tu cambio toca `shared/openapi.yaml`, menciónalo explícitamente en la descripción del PR —
  afecta a mobile, web y backend a la vez.
- Commits en español o inglés, lo que sea más natural para quien escribe — no hay una regla
  estricta todavía.

*(Esto es un punto de partida razonable, no una regla escrita en piedra — si el equipo prefiere
otra convención de branches o de revisión, este es el lugar para actualizarla.)*

---

## 5. Verificación antes de un PR

CI corre esto mismo en cada PR, en tres jobs — `API (Java 21)`, `JS/TS (Node 20)` y
`Navegador real (Playwright)`. Correrlo antes ahorra la vuelta:

```bash
# Backend — 169 tests, con Postgres embebido (no hace falta Docker)
cd api && ./mvnw clean test

# Shared + PWA — 549 tests
npm --prefix shared run build && npm --prefix shared run test
npm --prefix web run test
npm --prefix web run lint
npm --prefix web run build

# Navegador real
npm --prefix web run e2e

# Todo junto (humo end-to-end)
docker compose up --build
# abre http://localhost:5173 y http://localhost:8000/swagger-ui.html
```

> En Windows, `./mvnw` no encuentra Java si `JAVA_HOME` no está definida — y **sale con código 0**,
> así que parece que los tests pasaron cuando no llegaron a correr. Comprueba que la salida traiga
> `Tests run: N`.

Los tres checks son obligatorios para mergear. En cuanto entran a `main`, CI dispara los dos
despliegues; ver [`DESPLIEGUE.md`](./DESPLIEGUE.md) §6.

---

## 6. Gaps conocidos (para no fingir que no existen)

- **La redirección de Google no cubre el WebView que no dice nada.** Desde el #172, un popup
  bloqueado cae a `signInWithRedirect`, pero eso solo funciona cuando el navegador *avisa* con
  `auth/popup-blocked`. Un WebView que abre la ventana y nunca devuelve el control no lanza ningún
  error, así que no hay nada que detectar. Si aparecen reportes de ese caso, la salida sería un
  tiempo de espera, con el riesgo de mandar a Google a quien simplemente tardó en decidir.
- **Contenido que falta en el CMS.** De las 43 actividades de producción, 10 tienen solo el título:
  su texto no traía etiquetas de las que sacar propósito, duración o materiales, y rellenarlas sería
  inventar material pedagógico. Y la tabla de videos de introducción está vacía, así que se ven los
  cuatro que viajan con la app. Las dos cosas se resuelven desde `/admin`.
- **`*.supabase.co` sigue en la CSP.** Quedó de cuando el almacenamiento era Supabase. Probablemente
  ya no haga falta, pero quitarlo exige confirmar que no queda ninguna URL guardada apuntando ahí
  —incluida `users.photo`, que no sale por ningún endpoint público—.
- **La app Expo de `src/` sigue en el repositorio aunque ya no se publica.** Sus tests corren en CI y
  su código comparte `shared/` con la PWA. Retirarla es una limpieza pendiente, no un accidente.

---


## 7. Los dos entornos del proyecto

| Entorno | Para qué | Dónde |
|---|---|---|
| **Docker (local)** | Cada dev trabaja en su propia máquina — backend + web + Postgres con `docker compose up --build`. | Tu laptop — ver [`COMO-EMPEZAR.md`](./COMO-EMPEZAR.md) |
| **Firebase** | El entorno productivo real, el que usan las docentes. | `web/firebase.json` + Cloud Run + Cloud SQL — runbook en [`DESPLIEGUE.md`](./DESPLIEGUE.md) |

Son dos, no tres: hubo un entorno compartido en Render y se retiró en septiembre de 2026 junto con
la app móvil, que era su único motivo. El backend lee toda su configuración de variables de
entorno, nunca hardcodeada, y respeta el `PORT` que inyecta Cloud Run, así que moverse entre local
y producción no necesita ningún cambio de código.
