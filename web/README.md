# ExplorArte — Web

Desktop web app for ExplorArte (Sueños y Letras), built with **Vite + React +
TypeScript + React Router**. It mirrors the content of the 13 mobile screens but
is laid out for **computers**: a persistent left **sidebar navigation**, full-width
gradient banners, centered max-width content and responsive multi-column grids
(the auth/onboarding screens are centered in a card). It shares types, design
tokens and the API client with the mobile app via the sibling
[`../shared`](../shared) package. It is responsive — below ~760px the sidebar
collapses into a top bar.

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
