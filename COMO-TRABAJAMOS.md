# Cómo trabajamos en este proyecto

Esta guía es para cualquiera que se une al equipo y ya tiene el entorno corriendo (si no, ver
[`COMO-EMPEZAR.md`](./COMO-EMPEZAR.md) primero). Explica cómo está organizado el código, cómo
agregar una funcionalidad sin romper nada, y hacia dónde va el proyecto.

---

## 1. Mapa del repositorio

```
SueñosyLetras/
  src/              → App mobile (Expo Router). No corre en Docker.
  web/              → App web de escritorio (Vite + React Router).
  shared/           → El contrato de datos + cliente API. Lo usan mobile y web.
  api/              → Backend en Java (Spring Boot + PostgreSQL). Corre en Docker.
  docker-compose.yml, .env.example  → Levantan db + api + web con un comando.
```

| Si necesitas... | Empieza aquí |
|---|---|
| Levantar el proyecto por primera vez | [`COMO-EMPEZAR.md`](./COMO-EMPEZAR.md) |
| Entender el backend en Java (sin saber Java) | [`api/README.md`](./api/README.md) |
| Conectar mobile a la API sin correr Docker local | [`COMO-EMPEZAR.md`](./COMO-EMPEZAR.md#opción-a-recomendada-usar-la-api-compartida-del-equipo-en-render) (API compartida en Render) |
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
`VITE_API_MOCK_MODULES` / `EXPO_PUBLIC_API_MOCK_MODULES` en `COMO-EMPEZAR.md`) sin cambiar una
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

## 5. Verificación antes de un PR (checklist rápido)

No hay pipeline de CI todavía (ver sección de gaps abajo), así que esta verificación es manual:

```bash
# Backend
cd api && ./mvnw -q compile

# Shared
cd shared && npm run build && npm run typecheck

# Web
cd web && npm run build

# Mobile
npx tsc --noEmit -p tsconfig.json
npx expo-doctor

# Todo junto (humo end-to-end)
docker compose up --build
# abre http://localhost:5173 y http://localhost:8000/swagger-ui.html
```

---

## 6. Gaps conocidos (para no fingir que no existen)

- **No hay tests automatizados** — ni en el backend (JUnit) ni en el frontend (Vitest/Jest). Si
  vas a agregar los primeros, lo más valioso ahorita sería: tests de los controllers del
  backend (son los que tienen más lógica: likes por usuario, aprobación de roles, generación de
  slugs de topics) y tests del `mock` client en `shared/` (para que web y mobile no diverjan del
  contrato sin darse cuenta).
- **No hay linter/formatter configurado a nivel de repo** — `npm run lint` en la raíz corre
  `expo lint`, pero no hay convención impuesta para `web/` ni `api/` todavía.
- **OTP y "olvidé mi contraseña" son stubs en el backend** (`api/src/main/java/com/explorarte/api/auth/AuthController.java`)
  — no envían SMS/email real, solo loguean el código a consola. Hay que decidir un proveedor
  real (Twilio, SendGrid, etc.) antes de ir a producción con ese flujo.
- **El refactor de pantallas mobile a la API real es reciente** — vale la pena que alguien más
  las pruebe a fondo contra el backend real (no solo el mock) antes de confiar 100% en ellas.
- **CI/CD no existe** — ver [`DESPLIEGUE.md`](./DESPLIEGUE.md#posible-siguiente-paso-cicd) para
  la idea de cómo se vería.
- **Descarga offline de documentos/videos: la infraestructura ya existe, falta el contenido
  real** — `src/lib/offlineStorage.ts` y `src/lib/useNetworkStatus.ts` ya funcionan, pero nadie
  los usa todavía porque `ToolsContent.downloadables` sigue siendo solo texto, sin URLs de
  archivos reales. Ver [`OFFLINE.md`](./OFFLINE.md) para el plan completo antes de construir la
  UI de descarga.

---

## 7. Hacia dónde va el proyecto

El plan es hospedar la web y la API en **Firebase Hosting + Cloud Run**, con **Cloud SQL** como
base de datos de producción, y publicar mobile a las tiendas con **EAS Build**. El detalle
completo (comandos, variables de entorno de producción, costos) está en
[`DESPLIEGUE.md`](./DESPLIEGUE.md). El código ya está preparado para esto (el backend lee todo
su config de variables de entorno, respeta el `PORT` que inyecta Cloud Run, y `web/firebase.json`
ya tiene la configuración de Hosting lista) — falta el paso de crear las cuentas/proyectos reales
y desplegar, que le toca decidir al equipo.
