# Sueños y Letras 📚

App móvil (React Native + Expo) de alfabetización infantil basada en módulos de emociones.
Construida con **Expo SDK 54**, **Expo Router** (navegación por archivos), **react-native-svg** y **expo-linear-gradient**.

> 🆕 **¿Es tu primera vez con este proyecto, en una computadora nueva?** Sigue
> [`COMO-EMPEZAR.md`](./COMO-EMPEZAR.md) — guía paso a paso desde cero, sin dar por hecho que
> conoces Docker, Java o Expo.
>
> 🧭 **¿Ya lo tienes corriendo y quieres saber cómo trabajamos como equipo?** Ve a
> [`COMO-TRABAJAMOS.md`](./COMO-TRABAJAMOS.md) (arquitectura, cómo agregar una funcionalidad,
> convenciones). Para el despliegue —producción en Google Cloud, staging en Render— ve a
> [`DESPLIEGUE.md`](./DESPLIEGUE.md), que es el runbook único. Para cómo funciona el acceso sin
> internet a documentos y videos descargados, ve a [`OFFLINE.md`](./OFFLINE.md).

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

Cuentas de ejemplo precargadas por la API:

- `admin@explorarte.org` — administrador
- `maria@ejemplo.com`, `ana@ejemplo.com`, `lucia@ejemplo.com`, `sofia@ejemplo.com` — docentes

La contraseña de todas es la que pongas en `SEED_USER_PASSWORD` dentro de tu `.env`. **No se
publica aquí**: este repositorio es público y una contraseña escrita en el README acaba sirviendo
en algún entorno desplegado donde alguien la copió tal cual (SEC-02). Si dejas la variable vacía,
la API no crea ninguna cuenta de ejemplo.

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

## Entorno compartido en Render (desarrollo/staging)

El repo incluye un **blueprint** [`render.yaml`](./render.yaml) que publica el
backend real más dos sitios estáticos en [Render](https://render.com):

| Servicio | Origen | Qué es |
|-------|--------|--------|
| `explorarte-api` | `/api` (Docker) | La API Java real, contra una Postgres persistente |
| `explorarte-web` | `/web` (Vite + React) | Vista **web de escritorio** (sidebar, multi-columna) |
| `explorarte-mobile` | raíz (Expo web export) | Vista **mobile** en el navegador |

Los dos sitios apuntan a la API real vía `VITE_API_URL` / `EXPO_PUBLIC_API_URL`, que
`render.yaml` ya configura — **no corren contra el mock**, aunque este README lo dijera antes.

**Publicar:** en Render → **New → Blueprint** → conecta este repositorio. Render
detecta `render.yaml` y crea todo automáticamente. Cada push a la rama
re-despliega; los Pull Requests generan previews.

> **Esto es desarrollo/staging, no producción.** Producción va en Google Cloud (Firebase Hosting +
> Cloud Run + Cloud SQL). El runbook único es [`DESPLIEGUE.md`](./DESPLIEGUE.md).
>
> Las credenciales de este entorno no se publican; pídelas por un canal privado. Y es plan
> gratuito: tras un rato sin uso, el primer request puede tardar **más de 90 segundos**.

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
- La pestaña **Video** de cada módulo reproduce el video que un admin haya subido para esa
  pantalla desde el CMS web (`/admin/videos-intro`), con `expo-video`. Si no hay ninguno, la
  tarjeta simplemente no se muestra (`src/components/video-placeholder.tsx`). Si el archivo ya se
  descargó, se reproduce la copia local y funciona sin conexión.
  <br>*(`assets/video/demo.mp4` sigue en el repo pero ya no lo usa ningún componente — son 14 MB
  que se pueden borrar en una limpieza aparte.)*
- Los íconos están reimplementados como SVG en `src/components/icon.tsx`.
