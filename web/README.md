# ExplorArte — la PWA

**Es el producto**, en producción en [explorarte.app](https://explorarte.app). Vite + React 19 +
TypeScript + React Router, con `vite-plugin-pwa` para el service worker.

Responsive de verdad, no una vista de escritorio: por encima de ~760px hay una barra lateral
persistente y rejillas de varias columnas; por debajo, la barra se convierte en una superior y los
módulos suben a pestañas. Lo que una docente descargue a propósito le funciona después sin conexión
— ver [`../OFFLINE.md`](../OFFLINE.md).

Comparte tipos, tokens de diseño y cliente de API con `src/` a través de
[`../shared`](../shared).

## Run

```bash
cd web
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production bundle
npm run preview    # preview the production build
```

The app runs against an **in-memory mock client** by default — no backend needed.
Log in with any credentials (or "Continuar con Google").

### Cuentas demo (modo mock)

El rol y el estado se resuelven por **email** al iniciar sesión; cualquier
contraseña es válida. Las nuevas registraciones se crean como docentes
`pending` (pendientes de aprobación).

| Email | Rol | Estado | Para probar |
|-------|-----|--------|-------------|
| `admin@explorarte.org` | Administrador | Aprobado | Consola de administración (`/admin`) |
| `maria@ejemplo.com` | Docente | Aprobada | App de la docente (`/main`) |
| `ana@ejemplo.com`, `lucia@ejemplo.com` | Docente | Pendiente | Pantalla "cuenta pendiente" / aprobación |
| `sofia@ejemplo.com` | Docente | Aprobada | App de la docente |

> El estado mock es por sesión de página: las mutaciones de contenido y las
> aprobaciones no persisten al recargar.

## Switching to a real backend

Every screen talks to the backend through `@explorarte/shared`'s `ApiClient`
(`src/lib/api.ts`) — never `fetch` directly. To point the whole app at the real
REST API (see [`../shared/openapi.yaml`](../shared/openapi.yaml)):

```bash
echo "VITE_API_URL=http://localhost:8000" > .env
```

No screen code changes — the factory swaps the mock adapter for the HTTP adapter.

## Structure

```
src/
├── main.tsx              # entry: Router + AuthProvider
├── App.tsx               # routes (auth screens + post-login sidebar layout)
├── lib/api.ts            # the shared ApiClient instance (mock | http)
├── context/AuthContext   # session + current user
├── styles/               # tokens.css (mirrors shared tokens) + global.css (desktop layout)
├── components/           # Sidebar, TabsLayout, GradientHeader (banner), Field, Select, Icon, …
└── routes/               # one file per screen (Onboarding, Login, Main, …)
```
