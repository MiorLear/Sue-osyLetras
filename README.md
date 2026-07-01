# Sueños y Letras 📚

App móvil (React Native + Expo) de alfabetización infantil basada en módulos de emociones.
Construida con **Expo SDK 56**, **Expo Router** (navegación por archivos), **react-native-svg** y **expo-linear-gradient**.

> 🆕 **¿Es tu primera vez con este proyecto, en una computadora nueva?** Sigue
> [`COMO-EMPEZAR.md`](./COMO-EMPEZAR.md) — guía paso a paso desde cero, sin dar por hecho que
> conoces Docker, Java o Expo.

## Cómo levantar el proyecto

```bash
npm install        # solo la primera vez
npm start          # arranca el servidor de desarrollo (Metro)
```

Luego:

- **En tu teléfono (lo más fácil):** instala la app **Expo Go** (Android/iOS) y escanea el código QR que aparece en la terminal. Tu teléfono y la PC deben estar en la misma red Wi-Fi.
- **Emulador Android:** presiona `a` en la terminal (requiere Android Studio configurado).
- **Web (vista rápida):** presiona `w`.

Por defecto, tanto mobile como web corren contra un **cliente mock en memoria** (sin backend,
sin variables de entorno). Para conectarlos a la API real, sigue la siguiente sección.

## Backend + web (Docker) — no necesitas instalar Java

La API REST está hecha en **Java (Spring Boot)** y vive en [`api/`](./api). No necesitas tener
Java, Maven ni PostgreSQL instalados — todo corre dentro de Docker.

```bash
cp .env.example .env      # solo la primera vez — los valores por defecto ya funcionan
docker compose up --build
```

Esto levanta tres servicios:

| Servicio | URL | Qué es |
|---|---|---|
| `web` | http://localhost:5173 | La app web (Vite), ya conectada a la API real |
| `api` | http://localhost:8000 | La API Java, con datos de ejemplo precargados |
| `api` (docs) | http://localhost:8000/swagger-ui.html | Explora y prueba cada endpoint sin leer una línea de Java |
| `db` | localhost:5432 | PostgreSQL (Postgres), solo si necesitas conectarte con un cliente SQL |

Cuentas de ejemplo precargadas por la API (misma contraseña para todas:
`explorarte123`, o la que pongas en `SEED_USER_PASSWORD` dentro de `.env`):

- `admin@explorarte.org` — administrador
- `maria@ejemplo.com`, `ana@ejemplo.com`, `lucia@ejemplo.com`, `sofia@ejemplo.com` — docentes

Comandos útiles (equivalentes a `docker compose ...`, agregados a `package.json`):

```bash
npm run dev:stack             # docker compose up --build
npm run dev:stack:down        # apaga los contenedores
npm run dev:stack:reset-db    # borra la base de datos y la vuelve a poblar desde cero
npm run dev:stack:logs        # sigue los logs de todos los servicios
```

Ver [`api/README.md`](./api/README.md) para más detalle (hot reload, cómo resetear la BD, etc.).

### Conectar mobile a la API real

Mobile (Expo) sigue corriendo con `npm start`, **fuera** de Docker — así el teléfono puede
conectarse directo a tu red vía QR, igual que hoy. Para que use la API real en vez del mock,
copia `.env.example` a `.env` y ajusta:

```bash
# Si usas Expo Go en un teléfono físico, "localhost" no funciona — usa la IP
# de tu PC en la red local (ej. http://192.168.1.23:8000). Si vas a probar en
# el navegador o un emulador en la misma máquina, localhost sí funciona.
EXPO_PUBLIC_API_URL=http://192.168.1.23:8000
```

Tanto mobile como web soportan además `EXPO_PUBLIC_API_MOCK_MODULES` /
`VITE_API_MOCK_MODULES`: una lista separada por comas de módulos
(`auth,emotions,posts,events,learning,tools,profile,misc,admin`) que se
quedan en el mock aunque la URL de la API esté configurada — útil para seguir
trabajando en una pantalla sin depender de que esa parte de la API ya esté lista.

## Demos en Render (sin backend)

El repo incluye un **blueprint** [`render.yaml`](./render.yaml) que publica **dos
demos estáticas** en [Render](https://render.com), ambas contra el cliente **mock
en memoria** (no requieren backend ni variables de entorno):

| Sitio | Origen | Qué es |
|-------|--------|--------|
| `explorarte-web` | `/web` (Vite + React) | Demo **web de escritorio** (sidebar, multi-columna) |
| `explorarte-mobile` | raíz (Expo web export) | Demo **mobile** (vista de móvil en el navegador) |

**Publicar:** en Render → **New → Blueprint** → conecta este repositorio. Render
detecta `render.yaml` y crea ambos sitios automáticamente. Cada push a la rama
re-despliega; los Pull Requests generan previews.

> Login demo: cualquier contraseña sirve. Usa `admin@explorarte.org` (admin),
> `maria@ejemplo.com` (docente aprobada) o `ana@ejemplo.com` (docente pendiente).

## Estructura

```
src/
  app/                    # Rutas (Expo Router)
    _layout.tsx           # Stack raíz
    index.tsx             # Home  (/)
    login.tsx             # /login
    register.tsx          # /register
    forgot-password.tsx   # /forgot-password
    modules.tsx           # /modules
    module/[id].tsx       # /module/felicidad, /module/enojo, ...
    foro.tsx              # /foro  (acepta ?module=felicidad)
    calendar.tsx          # /calendar
    profile.tsx           # /profile
    faq.tsx               # /faq
  components/             # Logo, GradientHeader, BottomNav, Icon (SVG), UI
  constants/theme.ts      # Paleta y datos de los módulos
assets/logo.jpg           # Logo de la app
design-reference/         # Mockups originales (.dc.html) — solo referencia
```

## Navegación

El flujo arranca en **Home** (`/`). Desde el perfil puedes "Cerrar sesión" para ir a **Login**,
y desde Login/Registro se vuelve a Home. Las barras inferiores y botones replican el mapa de
navegación de los diseños originales.

## Notas

- La pantalla de Perfil usa `expo-image-picker` para cambiar la foto (funciona en Expo Go).
- El Calendario usa el **date/time picker nativo** (`@react-native-community/datetimepicker`)
  para elegir fecha y hora de los eventos.
- La pestaña **Video** de cada módulo reproduce el video demo (`assets/video/demo.mp4`)
  con `expo-video` y controles nativos.
- Los íconos están reimplementados como SVG en `src/components/icon.tsx`.
